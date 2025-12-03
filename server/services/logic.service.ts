import { getSupabaseClient, isSupabaseConfigured } from "../config/supabase";
import { passKitService } from "./passkit.service";

export type ActionType = 
  | "MEMBER_EARN" 
  | "MEMBER_REDEEM" 
  | "MEMBER_ADJUST"
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
const ONE_TIME_ACTIONS: ActionType[] = ["COUPON_REDEEM", "TICKET_CHECKIN", "INSTALL", "UNINSTALL"];

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

    const supabase = getSupabaseClient();
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
    } else if (actionType === "COUPON_REDEEM") {
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
    } else {
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
