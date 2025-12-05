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
  programId?: string;
  contact: BatchCampaignContact;
}

interface GenerateClaimCodeResult {
  success: boolean;
  claimCode?: string;
  passkitProgramId?: string;
  programId?: string;
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

  getClient(): SupabaseClient {
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
        p_program_id: params.programId || null,
      });

      if (error) {
        console.error("Generate claim code RPC error:", error);
        return {
          success: false,
          error: error.message || "Failed to generate claim code",
        };
      }

      console.log(`🎟️ Generated claim code: ${data?.claim_code} for program: ${params.programId || 'auto-resolved'}`);

      return {
        success: true,
        claimCode: data?.claim_code,
        programId: data?.program_id || params.programId,
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

  async processPassUninstall(passKitInternalId: string): Promise<{
    success: boolean;
    passUuid?: string;
    transactionId?: string;
    error?: string;
  }> {
    try {
      const client = this.getClient();

      // Use limit(1) instead of single() to gracefully handle no results
      // Only select columns that exist in passes_master
      const { data: passes, error: findError } = await client
        .from("passes_master")
        .update({ 
          status: "UNINSTALLED", 
          is_active: false,
          last_updated: new Date().toISOString()
        })
        .eq("passkit_internal_id", passKitInternalId)
        .select("id, external_id")
        .limit(1);

      const pass = passes?.[0];

      if (findError || !pass) {
        console.warn(`Pass ${passKitInternalId} not found in database`);
        return {
          success: false,
          error: findError?.message || "Pass not found",
        };
      }

      const { data: txn, error: txnError } = await client
        .from("transactions")
        .insert({
          pass_id: pass.id,
          action_type: "UNINSTALL",
          value_change: 0,
          notes: "Webhook: User removed pass from wallet",
        })
        .select("id")
        .single();

      if (txnError) {
        console.error("Failed to log uninstall transaction:", txnError);
      }

      console.log(`✅ Uninstall processed for pass ${passKitInternalId} (UUID: ${pass.id})`);

      return {
        success: true,
        passUuid: pass.id,
        transactionId: txn?.id,
      };
    } catch (error) {
      console.error("Process pass uninstall error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  isInitialized(): boolean {
    return this.initialized && isSupabaseConfigured();
  }

  async createPassFromEnrollment(params: {
    programId: string;
    passkitProgramId: string;
    passkitInternalId: string;
    userId: string;
    externalId: string;
    protocol?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    enrollmentSource?: "SMARTPASS" | "QR_SCAN" | "CLAIM_CODE";
  }): Promise<{
    success: boolean;
    passId?: string;
    isDuplicate?: boolean;
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const fullPassData: Record<string, any> = {
        program_id: params.programId,
        user_id: params.userId,
        passkit_internal_id: params.passkitInternalId,
        external_id: params.externalId,
        status: "INSTALLED",
        is_active: true,
        protocol: params.protocol || "MEMBERSHIP",
        points_balance: 0,
        member_email: params.email || null,
        member_first_name: params.firstName || null,
        member_last_name: params.lastName || null,
        enrollment_source: params.enrollmentSource || "SMARTPASS",
        last_updated: new Date().toISOString(),
      };

      const { data, error } = await client
        .from("passes_master")
        .upsert(fullPassData, { onConflict: "passkit_internal_id" })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505" || error.message?.includes("duplicate key")) {
          console.log(`   ℹ️ Duplicate pass detected (idempotent): ${params.passkitInternalId}`);
          return {
            success: true,
            isDuplicate: true,
          };
        }

        if (error.message?.includes("enrollment_source") || 
            error.message?.includes("member_email") ||
            error.message?.includes("member_first_name") ||
            error.message?.includes("member_last_name") ||
            error.message?.includes("points_balance") ||
            error.message?.includes("protocol") ||
            error.code === "PGRST204") {
          console.log("   ⚠️ Some columns don't exist, trying minimal insert...");
          
          const minimalPassData: Record<string, any> = {
            program_id: params.programId,
            user_id: params.userId,
            passkit_internal_id: params.passkitInternalId,
            external_id: params.externalId,
            status: "INSTALLED",
            is_active: true,
            protocol: params.protocol || "MEMBERSHIP",
          };

          const { data: minData, error: minError } = await client
            .from("passes_master")
            .upsert(minimalPassData, { onConflict: "passkit_internal_id" })
            .select("id")
            .single();

          if (minError) {
            if (minError.code === "23505" || minError.message?.includes("duplicate key")) {
              console.log(`   ℹ️ Duplicate pass detected (idempotent): ${params.passkitInternalId}`);
              return { success: true, isDuplicate: true };
            }
            console.error("Minimal pass creation also failed:", minError);
            return {
              success: false,
              error: minError.message || "Failed to create pass record (minimal)",
            };
          }

          console.log(`✅ Pass record created (minimal): ${minData?.id}`);
          return {
            success: true,
            passId: minData?.id,
          };
        }

        console.error("Create pass from enrollment error:", error);
        return {
          success: false,
          error: error.message || "Failed to create pass record",
        };
      }

      console.log(`✅ Pass record created: ${data?.id}`);

      return {
        success: true,
        passId: data?.id,
      };
    } catch (error) {
      console.error("Create pass from enrollment error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getProgramByPasskitId(passkitProgramId: string): Promise<{
    success: boolean;
    program?: {
      id: string;
      name: string;
      passkitProgramId: string;
      passkitTierId: string;
      postgridTemplateId: string | null;
      protocol: string;
      isSuspended: boolean;
      tierBronzeMax: number | null;
      tierSilverMax: number | null;
      tierGoldMax: number | null;
      passkitTierBronzeId: string | null;
      passkitTierSilverId: string | null;
      passkitTierGoldId: string | null;
      passkitTierPlatinumId: string | null;
    };
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("programs")
        .select(`
          id, name, passkit_program_id, passkit_tier_id, postgrid_template_id, protocol, is_suspended,
          tier_bronze_max, tier_silver_max, tier_gold_max,
          passkit_tier_bronze_id, passkit_tier_silver_id, passkit_tier_gold_id, passkit_tier_platinum_id
        `)
        .eq("passkit_program_id", passkitProgramId)
        .limit(1);

      if (error) {
        console.error("Get program by PassKit ID error:", error);
        return {
          success: false,
          error: error.message || "Failed to get program",
        };
      }

      const program = data?.[0];

      if (!program) {
        return {
          success: false,
          error: "Program not found",
        };
      }

      return {
        success: true,
        program: {
          id: program.id,
          name: program.name,
          passkitProgramId: program.passkit_program_id,
          passkitTierId: program.passkit_tier_id || "base",
          postgridTemplateId: program.postgrid_template_id,
          protocol: program.protocol || "MEMBERSHIP",
          isSuspended: program.is_suspended || false,
          tierBronzeMax: program.tier_bronze_max,
          tierSilverMax: program.tier_silver_max,
          tierGoldMax: program.tier_gold_max,
          passkitTierBronzeId: program.passkit_tier_bronze_id,
          passkitTierSilverId: program.passkit_tier_silver_id,
          passkitTierGoldId: program.passkit_tier_gold_id,
          passkitTierPlatinumId: program.passkit_tier_platinum_id,
        },
      };
    } catch (error) {
      console.error("Get program by PassKit ID error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getProgramById(programId: string): Promise<{
    success: boolean;
    program?: {
      id: string;
      name: string;
      passkit_program_id: string;
      passkit_tier_id: string;
      postgrid_template_id: string | null;
      protocol: string;
      is_suspended: boolean;
      campaign_budget_cents: number | null;
    };
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("programs")
        .select("id, name, passkit_program_id, passkit_tier_id, postgrid_template_id, protocol, is_suspended, campaign_budget_cents")
        .eq("id", programId)
        .limit(1);

      if (error) {
        console.error("Get program by ID error:", error);
        return {
          success: false,
          error: error.message || "Failed to get program",
        };
      }

      const program = data?.[0];

      if (!program) {
        return {
          success: false,
          error: "Program not found",
        };
      }

      return {
        success: true,
        program: {
          id: program.id,
          name: program.name,
          passkit_program_id: program.passkit_program_id,
          passkit_tier_id: program.passkit_tier_id || "base",
          postgrid_template_id: program.postgrid_template_id,
          protocol: program.protocol || "MEMBERSHIP",
          is_suspended: program.is_suspended || false,
          campaign_budget_cents: program.campaign_budget_cents,
        },
      };
    } catch (error) {
      console.error("Get program by ID error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async validateClientById(clientId: string): Promise<{
    success: boolean;
    client?: {
      id: string;
      name: string;
      programId: string;
      programName: string;
      passkitProgramId: string;
      protocol: string;
    };
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("tenants")
        .select(`
          id,
          business_name,
          programs!inner (
            id,
            name,
            passkit_program_id,
            protocol
          )
        `)
        .eq("id", clientId)
        .limit(1);

      if (error) {
        console.error("Validate client by ID error:", error);
        return {
          success: false,
          error: error.message || "Failed to validate client",
        };
      }

      const tenant = data?.[0];
      if (!tenant) {
        return {
          success: false,
          error: "Client not found",
        };
      }

      const program = Array.isArray(tenant.programs) 
        ? tenant.programs[0] 
        : tenant.programs;

      if (!program) {
        return {
          success: false,
          error: "Client has no associated program",
        };
      }

      return {
        success: true,
        client: {
          id: tenant.id,
          name: tenant.business_name || "Unknown",
          programId: program.id,
          programName: program.name || "Unknown Program",
          passkitProgramId: program.passkit_program_id || "",
          protocol: program.protocol || "MEMBERSHIP",
        },
      };
    } catch (error) {
      console.error("Validate client by ID error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getCampaignHistory(
    programId?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    success: boolean;
    campaigns?: any[];
    total?: number;
    error?: string;
  }> {
    try {
      const client = this.getClient();

      let query = client
        .from("campaign_runs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (programId) {
        query = query.eq("program_id", programId);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Get campaign history error:", error);
        return {
          success: false,
          error: error.message || "Failed to fetch campaign history",
        };
      }

      return {
        success: true,
        campaigns: data || [],
        total: count || 0,
      };
    } catch (error) {
      console.error("Get campaign history error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async getCampaignDetails(campaignId: string): Promise<{
    success: boolean;
    campaign?: any;
    contacts?: any[];
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data: campaign, error: campaignError } = await client
        .from("campaign_runs")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (campaignError) {
        console.error("Get campaign details error:", campaignError);
        return {
          success: false,
          error: campaignError.message || "Failed to fetch campaign",
        };
      }

      if (!campaign) {
        return {
          success: false,
          error: "Campaign not found",
        };
      }

      const { data: contacts, error: contactsError } = await client
        .from("campaign_contacts")
        .select("*")
        .eq("campaign_run_id", campaignId)
        .order("created_at", { ascending: true });

      if (contactsError) {
        console.warn("Could not fetch campaign contacts:", contactsError.message);
      }

      return {
        success: true,
        campaign,
        contacts: contacts || [],
      };
    } catch (error) {
      console.error("Get campaign details error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async createCampaignRun(campaignData: {
    programId: string;
    clientId?: string;
    resourceType: string;
    size?: string;
    mailingClass?: string;
    templateId?: string;
    frontTemplateId?: string;
    backTemplateId?: string;
    protocol?: string;
    description?: string;
    name?: string;
    totalContacts: number;
    estimatedCostCents?: number;
    createdBy: string;
  }): Promise<{
    success: boolean;
    campaignId?: string;
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("campaign_runs")
        .insert({
          program_id: campaignData.programId,
          client_id: campaignData.clientId,
          resource_type: campaignData.resourceType,
          size: campaignData.size,
          mailing_class: campaignData.mailingClass || "standard_class",
          template_id: campaignData.templateId,
          front_template_id: campaignData.frontTemplateId,
          back_template_id: campaignData.backTemplateId,
          protocol: campaignData.protocol,
          description: campaignData.description,
          name: campaignData.name,
          total_contacts: campaignData.totalContacts,
          estimated_cost_cents: campaignData.estimatedCostCents,
          created_by: campaignData.createdBy,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Create campaign run error:", error);
        return {
          success: false,
          error: error.message || "Failed to create campaign run",
        };
      }

      return {
        success: true,
        campaignId: data?.id,
      };
    } catch (error) {
      console.error("Create campaign run error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async updateCampaignStatus(
    campaignId: string,
    status: string,
    successCount?: number,
    failedCount?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();

      const updateData: Record<string, any> = { status };

      if (successCount !== undefined) {
        updateData.success_count = successCount;
      }
      if (failedCount !== undefined) {
        updateData.failed_count = failedCount;
      }

      if (status === "processing") {
        updateData.started_at = new Date().toISOString();
      } else if (status === "completed" || status === "failed") {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await client
        .from("campaign_runs")
        .update(updateData)
        .eq("id", campaignId);

      if (error) {
        console.error("Update campaign status error:", error);
        return {
          success: false,
          error: error.message || "Failed to update campaign status",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Update campaign status error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async createCampaignContact(contactData: {
    campaignRunId: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    country?: string;
    claimCode?: string;
    claimUrl?: string;
  }): Promise<{ success: boolean; contactId?: string; error?: string }> {
    try {
      const client = this.getClient();

      const { data, error } = await client
        .from("campaign_contacts")
        .insert({
          campaign_run_id: contactData.campaignRunId,
          first_name: contactData.firstName,
          last_name: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone,
          address_line_1: contactData.addressLine1,
          address_line_2: contactData.addressLine2,
          city: contactData.city,
          state: contactData.state,
          postal_code: contactData.postalCode,
          country: contactData.country || "US",
          claim_code: contactData.claimCode,
          claim_url: contactData.claimUrl,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Create campaign contact error:", error);
        return {
          success: false,
          error: error.message || "Failed to create campaign contact",
        };
      }

      return {
        success: true,
        contactId: data?.id,
      };
    } catch (error) {
      console.error("Create campaign contact error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async updateCampaignContact(
    contactId: string,
    updates: {
      status?: string;
      errorMessage?: string;
      postgridMailId?: string;
      postgridStatus?: string;
      estimatedDeliveryDate?: string;
      passkitPassId?: string;
      passkitStatus?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();

      const updateData: Record<string, any> = {};

      if (updates.status) updateData.status = updates.status;
      if (updates.errorMessage) updateData.error_message = updates.errorMessage;
      if (updates.postgridMailId) updateData.postgrid_mail_id = updates.postgridMailId;
      if (updates.postgridStatus) updateData.postgrid_status = updates.postgridStatus;
      if (updates.estimatedDeliveryDate) updateData.estimated_delivery_date = updates.estimatedDeliveryDate;
      if (updates.passkitPassId) updateData.passkit_pass_id = updates.passkitPassId;
      if (updates.passkitStatus) updateData.passkit_status = updates.passkitStatus;

      if (updates.status === "sent" || updates.status === "processing") {
        updateData.processed_at = new Date().toISOString();
      }

      const { error } = await client
        .from("campaign_contacts")
        .update(updateData)
        .eq("id", contactId);

      if (error) {
        console.error("Update campaign contact error:", error);
        return {
          success: false,
          error: error.message || "Failed to update campaign contact",
        };
      }

      return { success: true };
    } catch (error) {
      console.error("Update campaign contact error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }
}

export const supabaseService = new SupabaseService();
