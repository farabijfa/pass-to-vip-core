import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import type { 
  MembershipTransaction, 
  MembershipTransactionResponse,
  OneTimeUse,
  OneTimeUseResponse 
} from "@shared/schema";

class SupabaseService {
  private client: SupabaseClient | null = null;
  private initialized = false;

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.");
      }
      this.client = createClient(config.supabase.url, config.supabase.anonKey);
      this.initialized = true;
    }
    return this.client;
  }

  async healthCheck(): Promise<{ status: "connected" | "disconnected" | "error"; latency?: number }> {
    if (!isSupabaseConfigured()) {
      return { status: "disconnected" };
    }

    try {
      const startTime = Date.now();
      const client = this.getClient();
      
      const { error } = await client.from("_health_check").select("*").limit(1).maybeSingle();
      
      const latency = Date.now() - startTime;
      
      if (error && !error.message.includes("does not exist")) {
        return { status: "error" };
      }
      
      return { status: "connected", latency };
    } catch (error) {
      return { status: "error" };
    }
  }

  async processMembershipTransaction(
    transaction: MembershipTransaction
  ): Promise<MembershipTransactionResponse> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("process_membership_transaction", {
        p_member_id: transaction.memberId,
        p_transaction_type: transaction.transactionType,
        p_points: transaction.points,
        p_description: transaction.description || null,
        p_metadata: transaction.metadata || null,
        p_store_id: transaction.storeId || null,
        p_pass_serial_number: transaction.passSerialNumber || null,
      });

      if (error) {
        console.error("Supabase RPC error:", error);
        return {
          success: false,
          error: error.message || "Failed to process membership transaction",
        };
      }

      return {
        success: true,
        transactionId: data?.transaction_id,
        newBalance: data?.new_balance,
        previousBalance: data?.previous_balance,
        message: data?.message || "Transaction processed successfully",
      };
    } catch (error) {
      console.error("Membership transaction error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async processOneTimeUse(request: OneTimeUse): Promise<OneTimeUseResponse> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("process_one_time_use", {
        p_member_id: request.memberId,
        p_offer_id: request.offerId,
        p_redemption_code: request.redemptionCode || null,
        p_store_id: request.storeId || null,
        p_metadata: request.metadata || null,
      });

      if (error) {
        console.error("Supabase RPC error:", error);
        return {
          success: false,
          error: error.message || "Failed to process one-time use",
        };
      }

      return {
        success: true,
        redemptionId: data?.redemption_id,
        offerDetails: data?.offer_details ? {
          offerId: data.offer_details.offer_id,
          offerName: data.offer_details.offer_name,
          offerValue: data.offer_details.offer_value,
        } : undefined,
        message: data?.message || "One-time use processed successfully",
      };
    } catch (error) {
      console.error("One-time use error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getMemberBalance(memberId: string): Promise<{ balance: number } | null> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("get_member_balance", {
        p_member_id: memberId,
      });

      if (error) {
        console.error("Get balance error:", error);
        return null;
      }

      return { balance: data?.balance || 0 };
    } catch (error) {
      console.error("Get balance error:", error);
      return null;
    }
  }

  async getMemberTransactionHistory(
    memberId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("get_member_transaction_history", {
        p_member_id: memberId,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        console.error("Get transaction history error:", error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error("Get transaction history error:", error);
      return [];
    }
  }

  isInitialized(): boolean {
    return this.initialized && isSupabaseConfigured();
  }
}

export const supabaseService = new SupabaseService();
