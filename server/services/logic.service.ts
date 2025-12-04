import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase";
import { passKitService } from "./passkit.service";

export type ActionType = 
  | "MEMBER_EARN" 
  | "MEMBER_REDEEM" 
  | "MEMBER_ADJUST"
  | "COUPON_ISSUE"
  | "COUPON_REDEEM" 
  | "TICKET_CHECKIN" 
  | "INSTALL" 
  | "UNINSTALL";

interface PosActionResult {
  success: boolean;
  message: string;
  data?: {
    transaction_id?: string;
    redemption_id?: string;
    new_balance?: number;
    previous_balance?: number;
    passkit_internal_id?: string;
    notification_message?: string;
    protocol?: string;
    offer_details?: {
      offer_id: string;
      offer_name: string;
      offer_value: number;
    };
  };
  passKitSync?: {
    synced: boolean;
    error?: string;
  };
}

const MEMBERSHIP_ACTIONS: ActionType[] = ["MEMBER_EARN", "MEMBER_REDEEM", "MEMBER_ADJUST"];
const COUPON_ACTIONS: ActionType[] = ["COUPON_ISSUE", "COUPON_REDEEM"];
const ONE_TIME_ACTIONS: ActionType[] = ["COUPON_ISSUE", "COUPON_REDEEM", "TICKET_CHECKIN", "INSTALL", "UNINSTALL"];

class LogicService {
  async handlePosAction(
    externalId: string,
    actionType: ActionType,
    amount?: number
  ): Promise<PosActionResult> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
    }

    console.log(`\n[Logic] Processing Action: ${actionType} for ID: ${externalId}`);

    const supabase = getSupabaseClient();

    // Check if program is suspended before processing any action
    const { data: passData, error: passError } = await supabase
      .from("passes_master")
      .select(`
        id,
        program:programs!inner (
          id,
          name,
          is_suspended
        )
      `)
      .eq("external_id", externalId)
      .single();

    if (passError) {
      console.error("[Logic] Pass lookup error:", passError.message);
      throw new Error(`Pass not found: ${passError.message}`);
    }

    const program = passData?.program as unknown as { id: string; name: string; is_suspended: boolean } | null;
    if (program?.is_suspended) {
      console.error(`[Logic] Program "${program.name}" is SUSPENDED - blocking action`);
      throw new Error("Program Suspended. Contact Admin.");
    }

    let rpcName: string;
    let rpcParams: Record<string, any> = {
      p_external_id: externalId,
      p_action: actionType,
    };

    if (MEMBERSHIP_ACTIONS.includes(actionType)) {
      rpcName = "process_membership_transaction";
      rpcParams.p_amount = parseInt(String(amount)) || 0;
    } else if (ONE_TIME_ACTIONS.includes(actionType)) {
      rpcName = "process_one_time_use";
    } else {
      throw new Error(`Unknown Action Type: ${actionType}`);
    }
    const { data: rpcResult, error } = await supabase.rpc(rpcName, rpcParams);

    if (error) {
      console.error("[Logic] Supabase RPC Error:", error.message);
      throw new Error(error.message);
    }

    console.log("[Logic] Database Transaction Success:", rpcResult?.notification_message);

    let protocol: string;
    let skipPassKitSync = false;
    
    if (MEMBERSHIP_ACTIONS.includes(actionType)) {
      protocol = "MEMBERSHIP";
    } else if (COUPON_ACTIONS.includes(actionType)) {
      protocol = "COUPON";
    } else if (actionType === "TICKET_CHECKIN") {
      protocol = "EVENT_TICKET";
    } else if (actionType === "INSTALL" || actionType === "UNINSTALL") {
      protocol = "LIFECYCLE";
      skipPassKitSync = true;
    } else {
      protocol = "OTHER";
      skipPassKitSync = true;
    }

    let passKitSync = { synced: false, error: undefined as string | undefined, skipped: false };
    
    if (skipPassKitSync) {
      console.log(`[Logic] PassKit Sync skipped for ${protocol} action`);
      passKitSync.skipped = true;
    } else if (actionType === "COUPON_ISSUE") {
      // COUPON_ISSUE: Create new coupon in PassKit (requires campaignId + offerId from Supabase)
      try {
        console.log(`[Logic] Issuing new coupon via PassKit...`);
        const issueResult = await passKitService.issueCoupon({
          campaignId: rpcResult?.passkit_campaign_id,
          offerId: rpcResult?.passkit_offer_id,
          externalId: rpcResult?.passkit_internal_id,
          email: rpcResult?.email,
          firstName: rpcResult?.first_name,
          lastName: rpcResult?.last_name,
        });
        passKitSync = { synced: issueResult.success, error: issueResult.error, skipped: false };
      } catch (syncError) {
        console.error("[Logic] PassKit Coupon Issue Warning:", syncError);
        passKitSync.error = syncError instanceof Error ? syncError.message : "Coupon issue failed";
      }
    } else {
      // Standard sync for MEMBERSHIP, COUPON_REDEEM, EVENT_TICKET
      try {
        const syncResult = await passKitService.syncPass({
          passkit_internal_id: rpcResult?.passkit_internal_id,
          passkit_program_id: rpcResult?.passkit_program_id,
          protocol,
          notification_message: rpcResult?.notification_message,
          new_balance: rpcResult?.new_balance,
          member_name: rpcResult?.member_name,
          tier_level: rpcResult?.tier_level,
        });
        passKitSync = { synced: syncResult.synced, error: syncResult.error, skipped: false };
      } catch (syncError) {
        console.error("[Logic] PassKit Sync Warning:", syncError);
        passKitSync.error = syncError instanceof Error ? syncError.message : "Sync failed";
      }
    }

    return {
      success: true,
      message: rpcResult?.notification_message || "Action processed successfully",
      data: { ...rpcResult, protocol },
      passKitSync,
    };
  }

  isValidAction(action: string): action is ActionType {
    return [...MEMBERSHIP_ACTIONS, ...ONE_TIME_ACTIONS].includes(action as ActionType);
  }

  getAvailableActions(): ActionType[] {
    return [...MEMBERSHIP_ACTIONS, ...ONE_TIME_ACTIONS];
  }
}

export const logicService = new LogicService();
