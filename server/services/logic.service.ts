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
    points_processed?: number;
    transaction_amount?: number;
    multiplier_used?: number;
    passkit_internal_id?: string;
    notification_message?: string;
    protocol?: string;
    tier_level?: string;
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

interface ClaimAttemptResult {
  success: boolean;
  data?: {
    id: string;
    code: string;
    program_id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    points_initial: number;
    tier_level: string | null;
    claimed_at: string;
  };
  error?: string;
  claimed_at?: string;
}

const MEMBERSHIP_ACTIONS: ActionType[] = ["MEMBER_EARN", "MEMBER_REDEEM", "MEMBER_ADJUST"];
const COUPON_ACTIONS: ActionType[] = ["COUPON_ISSUE", "COUPON_REDEEM"];
const ONE_TIME_ACTIONS: ActionType[] = ["COUPON_ISSUE", "COUPON_REDEEM", "TICKET_CHECKIN", "INSTALL", "UNINSTALL"];

class LogicService {
  /**
   * Process a POS action (earn, redeem, adjust) with atomic transaction safety
   * Gap F Fix: Uses process_membership_transaction_atomic for race-condition-proof redemptions
   */
  async handlePosAction(
    externalId: string,
    actionType: ActionType,
    amount?: number,
    transactionAmount?: number
  ): Promise<PosActionResult> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
    }

    console.log(`\n[Logic] Processing Action: ${actionType} for ID: ${externalId}`);

    const supabase = getSupabaseClient();

    let rpcResult: any;
    let error: any;

    if (MEMBERSHIP_ACTIONS.includes(actionType)) {
      // Gap F Fix: Use atomic RPC for membership transactions
      // This prevents race conditions on concurrent redemptions
      const rpcParams = {
        p_external_id: externalId,
        p_action: actionType,
        p_amount: parseInt(String(amount)) || 0,
        p_transaction_amount: transactionAmount !== undefined ? transactionAmount : null,
      };

      console.log("[Logic] Using atomic transaction RPC with params:", rpcParams);

      const result = await supabase.rpc("process_membership_transaction_atomic", rpcParams);
      rpcResult = result.data;
      error = result.error;

      // Handle atomic RPC error responses
      if (!error && rpcResult && !rpcResult.success) {
        const errorCode = rpcResult.error;
        console.error(`[Logic] Atomic RPC returned error: ${errorCode}`);
        
        if (errorCode === "INSUFFICIENT_FUNDS") {
          throw new Error(`Insufficient balance. Available: ${rpcResult.available_balance}, Requested: ${rpcResult.requested_amount}`);
        } else if (errorCode === "MEMBER_NOT_FOUND") {
          throw new Error("Member not found");
        } else if (errorCode === "PROGRAM_SUSPENDED") {
          throw new Error("Program Suspended. Contact Admin.");
        } else if (errorCode === "INVALID_AMOUNT") {
          throw new Error("Invalid transaction amount");
        } else if (errorCode === "INVALID_ACTION") {
          throw new Error(`Invalid action type: ${actionType}`);
        }
        throw new Error(errorCode || "Transaction failed");
      }

    } else if (ONE_TIME_ACTIONS.includes(actionType)) {
      // For one-time actions, check program suspension first
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

      const result = await supabase.rpc("process_one_time_use", {
        p_external_id: externalId,
        p_action: actionType,
      });
      rpcResult = result.data;
      error = result.error;
    } else {
      throw new Error(`Unknown Action Type: ${actionType}`);
    }

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

  async lookupMember(externalId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, error: "Supabase is not configured" };
    }

    try {
      const supabase = getSupabaseClient();

      const { data: passData, error: passError } = await supabase
        .from("passes_master")
        .select(`
          id,
          external_id,
          status,
          is_active,
          enrollment_source,
          protocol,
          passkit_internal_id
        `)
        .eq("external_id", externalId)
        .single();

      if (passError) {
        console.error("[Logic] Member lookup error:", passError.message);
        return { success: false, error: "Member not found" };
      }

      return {
        success: true,
        data: {
          member: {
            id: passData.id,
            external_id: passData.external_id,
            first_name: "Member",
            last_name: "",
            email: "",
            phone: null,
            points_balance: 0,
            tier_name: "Standard",
            status: passData.status || "UNKNOWN",
            enrollment_source: passData.enrollment_source || "UNKNOWN",
            created_at: new Date().toISOString(),
          },
          balance: 0,
        },
      };
    } catch (error) {
      console.error("[Logic] Member lookup error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Lookup failed" };
    }
  }

  /**
   * Process a claim code attempt with atomic one-time-use guarantee
   * Gap E Fix: Uses process_claim_attempt RPC to prevent double-claims
   * 
   * @param code The claim code (e.g., from a postcard)
   * @param programId The program UUID
   * @returns Claim result with member data or error
   */
  async processClaimAttempt(
    code: string,
    programId: string
  ): Promise<ClaimAttemptResult> {
    if (!isSupabaseConfigured()) {
      throw new Error("Supabase is not configured");
    }

    console.log(`[Logic] Processing claim attempt for code: ${code.substring(0, 8)}...`);

    const supabase = getSupabaseClient();

    // Call the atomic claim RPC
    const { data: claimResult, error: claimError } = await supabase.rpc("process_claim_attempt", {
      p_code: code,
      p_program_id: programId,
    });

    if (claimError) {
      console.error("[Logic] Claim RPC error:", claimError.message);
      throw new Error(claimError.message);
    }

    // Handle the RPC response
    if (!claimResult.success) {
      const errorCode = claimResult.error;
      console.warn(`[Logic] Claim attempt failed: ${errorCode}`);

      if (errorCode === "ALREADY_CLAIMED") {
        const claimedAt = claimResult.claimed_at 
          ? new Date(claimResult.claimed_at).toLocaleDateString()
          : "previously";
        return {
          success: false,
          error: "ALREADY_CLAIMED",
          claimed_at: claimResult.claimed_at,
        };
      }

      if (errorCode === "INVALID_CODE") {
        return {
          success: false,
          error: "INVALID_CODE",
        };
      }

      return {
        success: false,
        error: errorCode || "CLAIM_FAILED",
      };
    }

    console.log("[Logic] Claim code validated and burned successfully");

    return {
      success: true,
      data: claimResult.data,
    };
  }

  /**
   * Get a user-friendly error message for claim failures
   */
  getClaimErrorMessage(error: string, claimedAt?: string): string {
    switch (error) {
      case "ALREADY_CLAIMED":
        if (claimedAt) {
          return `This code was already claimed on ${new Date(claimedAt).toLocaleDateString()}`;
        }
        return "This code has already been claimed";
      case "INVALID_CODE":
        return "Invalid claim code";
      case "CLAIM_FAILED":
        return "Failed to process claim";
      default:
        return error || "An error occurred";
    }
  }

  isValidAction(action: string): action is ActionType {
    return [...MEMBERSHIP_ACTIONS, ...ONE_TIME_ACTIONS].includes(action as ActionType);
  }

  getAvailableActions(): ActionType[] {
    return [...MEMBERSHIP_ACTIONS, ...ONE_TIME_ACTIONS];
  }
}

export const logicService = new LogicService();
