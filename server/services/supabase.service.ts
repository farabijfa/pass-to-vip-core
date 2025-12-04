import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import type { 
  MembershipTransaction, 
  MembershipTransactionResponse,
  OneTimeUse,
  OneTimeUseResponse,
  ClaimCode,
  BatchCampaignContact
} from "@shared/schema";

interface GenerateClaimCodeParams {
  passkitProgramId: string;
  contact: BatchCampaignContact;
}

interface GenerateClaimCodeResult {
  success: boolean;
  claimCode?: string;
  passkitProgramId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  error?: string;
}

interface LookupClaimCodeResult {
  success: boolean;
  claimCode?: ClaimCode;
  error?: string;
}

class SupabaseService {
  private client: SupabaseClient | null = null;
  private initialized = false;

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
      }
      const key = config.supabase.serviceRoleKey || config.supabase.anonKey;
      this.client = createClient(config.supabase.url, key);
      this.initialized = true;
    }
    return this.client;
  }

  async healthCheck(): Promise<{ status: "connected" | "disconnected" | "error"; latency?: number; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { status: "disconnected", message: "Supabase not configured" };
    }

    try {
      const startTime = Date.now();
      const client = this.getClient();
      
      const { data, error } = await client.rpc("get_service_status").maybeSingle();
      
      const latency = Date.now() - startTime;
      
      if (error) {
        if (error.message.includes("function") && error.message.includes("does not exist")) {
          return { status: "connected", latency, message: "Connected (RPC not configured yet)" };
        }
        console.error("Supabase health check error:", error.message);
        return { status: "connected", latency, message: "Connected but RPC error" };
      }
      
      return { status: "connected", latency };
    } catch (error) {
      console.error("Supabase connection error:", error);
      return { status: "error", message: error instanceof Error ? error.message : "Unknown error" };
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

  async generateClaimCode(params: GenerateClaimCodeParams): Promise<GenerateClaimCodeResult> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("generate_claim_code", {
        p_passkit_program_id: params.passkitProgramId,
        p_first_name: params.contact.firstName,
        p_last_name: params.contact.lastName || null,
        p_email: params.contact.email || null,
        p_address_line_1: params.contact.addressLine1,
        p_address_line_2: params.contact.addressLine2 || null,
        p_city: params.contact.city,
        p_state: params.contact.state,
        p_postal_code: params.contact.postalCode,
        p_country: params.contact.country || 'US',
      });

      if (error) {
        console.error("Generate claim code RPC error:", error);
        return {
          success: false,
          error: error.message || "Failed to generate claim code",
        };
      }

      console.log(`🎟️ Generated claim code: ${data?.claim_code}`);

      return {
        success: true,
        claimCode: data?.claim_code,
        passkitProgramId: params.passkitProgramId,
        firstName: params.contact.firstName,
        lastName: params.contact.lastName,
        email: params.contact.email,
      };
    } catch (error) {
      console.error("Generate claim code error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async lookupClaimCode(claimCode: string): Promise<LookupClaimCodeResult> {
    try {
      const client = this.getClient();

      const { data, error } = await client.rpc("lookup_claim_code", {
        p_claim_code: claimCode,
      });

      if (error) {
        console.error("Lookup claim code RPC error:", error);
        return {
          success: false,
          error: error.message || "Claim code not found",
        };
      }

      // Check for empty results (null, undefined, empty array, or empty object)
      if (!data || (Array.isArray(data) && data.length === 0) || (typeof data === 'object' && !data.claim_code)) {
        return {
          success: false,
          error: "Claim code not found",
        };
      }

      // Handle array result (some RPCs return arrays)
      const claimData = Array.isArray(data) ? data[0] : data;

      if (!claimData || !claimData.claim_code) {
        return {
          success: false,
          error: "Claim code not found",
        };
      }

      return {
        success: true,
        claimCode: {
          claimCode: claimData.claim_code,
          status: claimData.status,
          passkitProgramId: claimData.passkit_program_id,
          passkitInstallUrl: claimData.passkit_install_url,
          firstName: claimData.first_name,
          lastName: claimData.last_name,
          email: claimData.email,
          createdAt: claimData.created_at,
          installedAt: claimData.installed_at,
        },
      };
    } catch (error) {
      console.error("Lookup claim code error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async updateClaimCodeStatus(
    claimCode: string,
    status: "INSTALLED" | "EXPIRED" | "CANCELLED",
    passkitInstallUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();

      const { error } = await client.rpc("update_claim_code_status", {
        p_claim_code: claimCode,
        p_status: status,
        p_passkit_install_url: passkitInstallUrl || null,
      });

      if (error) {
        console.error("Update claim code status RPC error:", error);
        return {
          success: false,
          error: error.message || "Failed to update claim code status",
        };
      }

      console.log(`✅ Claim code ${claimCode} updated to ${status}`);

      return { success: true };
    } catch (error) {
      console.error("Update claim code status error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async upsertUser(params: {
    email: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string | null;
    phoneNumber?: string | null;
  }): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("users")
        .upsert(
          {
            email: params.email,
            first_name: params.firstName || null,
            last_name: params.lastName || null,
            birth_date: params.birthDate || null,
            phone_number: params.phoneNumber || null,
          },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (error) {
        console.error("Upsert user error:", error);
        return {
          success: false,
          error: error.message || "Failed to upsert user",
        };
      }

      return {
        success: true,
        userId: data?.id,
      };
    } catch (error) {
      console.error("Upsert user error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  isInitialized(): boolean {
    return this.initialized && isSupabaseConfigured();
  }
}

export const supabaseService = new SupabaseService();
