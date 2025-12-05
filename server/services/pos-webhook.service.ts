/**
 * POS Webhook Service (v2.6.0)
 * 
 * Handles external POS transaction processing for spend-based tier calculation.
 * Supports cumulative spend tracking and automatic tier upgrades with discounts.
 * 
 * Flow:
 * 1. Receive transaction from external POS (e.g., Levi's)
 * 2. Upsert member by external ID
 * 3. Record spend in ledger
 * 4. Update cumulative spend total
 * 5. Calculate tier based on spend thresholds
 * 6. Apply tier discount configuration
 * 7. Sync PassKit pass with new tier
 * 8. Return pass URL and discount info
 * 
 * Database Requirements:
 * - passes_master table must have: id, program_id, external_id, status, enrollment_source columns
 * - Optional columns: first_name, last_name, email, spend_total_cents, spend_tier_level
 * - spend_ledger table must exist (from migration 025)
 * - programs table must have tier configuration columns (from migration 025)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { config } from "../config";
import { isSupabaseConfigured } from "../config/supabase";
import { TierLevel } from "../utils/tier-calculator";
import { POSWebhookTransaction, POSWebhookResponse } from "@shared/schema";

interface SpendTierConfig {
  tier2ThresholdCents: number;
  tier3ThresholdCents: number;
  tier4ThresholdCents: number;
  tier1DiscountPercent: number;
  tier2DiscountPercent: number;
  tier3DiscountPercent: number;
  tier4DiscountPercent: number;
  tierNames: {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
  };
}

interface ProgramConfig {
  id: string;
  name: string;
  protocol: string;
  passkitProgramId: string | null;
  passkitTierId: string | null;
  passkitTierBronzeId: string | null;
  passkitTierSilverId: string | null;
  passkitTierGoldId: string | null;
  passkitTierPlatinumId: string | null;
  enrollmentUrl: string | null;
  tierConfig: SpendTierConfig;
}

interface MemberRecord {
  id: string;
  externalId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  spendTotalCents: number;
  tierLevel: TierLevel;
  passSerialNumber: string | null;
  passUrl: string | null;
  createdAt: string;
}

export class POSWebhookService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured");
      }
      this.client = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );
    }
    return this.client;
  }

  /**
   * Calculate tier level based on cumulative spend
   */
  calculateSpendTier(spendTotalCents: number, config: SpendTierConfig): TierLevel {
    if (spendTotalCents >= config.tier4ThresholdCents) {
      return 'TIER_4';
    }
    if (spendTotalCents >= config.tier3ThresholdCents) {
      return 'TIER_3';
    }
    if (spendTotalCents >= config.tier2ThresholdCents) {
      return 'TIER_2';
    }
    return 'TIER_1';
  }

  /**
   * Get discount percentage for a tier level
   */
  getDiscountForTier(tierLevel: TierLevel, config: SpendTierConfig): number {
    switch (tierLevel) {
      case 'TIER_4': return config.tier4DiscountPercent;
      case 'TIER_3': return config.tier3DiscountPercent;
      case 'TIER_2': return config.tier2DiscountPercent;
      case 'TIER_1': 
      default: return config.tier1DiscountPercent;
    }
  }

  /**
   * Get tier name for display
   */
  getTierName(tierLevel: TierLevel, config: SpendTierConfig): string {
    switch (tierLevel) {
      case 'TIER_4': return config.tierNames.tier4;
      case 'TIER_3': return config.tierNames.tier3;
      case 'TIER_2': return config.tierNames.tier2;
      case 'TIER_1': 
      default: return config.tierNames.tier1;
    }
  }

  /**
   * Load program configuration including tier thresholds and discounts
   * Note: Uses only essential columns that exist after migration 025
   */
  async getProgramConfig(programId: string): Promise<ProgramConfig | null> {
    const client = this.getClient();

    const { data: program, error } = await client
      .from("programs")
      .select(`
        id,
        name,
        protocol,
        passkit_program_id,
        passkit_tier_id,
        enrollment_url,
        spend_tier_2_threshold_cents,
        spend_tier_3_threshold_cents,
        spend_tier_4_threshold_cents,
        tier_1_discount_percent,
        tier_2_discount_percent,
        tier_3_discount_percent,
        tier_4_discount_percent,
        tier_1_name,
        tier_2_name,
        tier_3_name,
        tier_4_name,
        tier_system_type
      `)
      .eq("id", programId)
      .single();

    if (error || !program) {
      console.error("[POS Webhook] Program not found:", programId, error);
      return null;
    }

    return {
      id: program.id,
      name: program.name,
      protocol: program.protocol,
      passkitProgramId: program.passkit_program_id,
      passkitTierId: program.passkit_tier_id,
      passkitTierBronzeId: null,
      passkitTierSilverId: null,
      passkitTierGoldId: null,
      passkitTierPlatinumId: null,
      enrollmentUrl: program.enrollment_url,
      tierConfig: {
        tier2ThresholdCents: program.spend_tier_2_threshold_cents ?? 30000,
        tier3ThresholdCents: program.spend_tier_3_threshold_cents ?? 100000,
        tier4ThresholdCents: program.spend_tier_4_threshold_cents ?? 250000,
        tier1DiscountPercent: program.tier_1_discount_percent ?? 0,
        tier2DiscountPercent: program.tier_2_discount_percent ?? 5,
        tier3DiscountPercent: program.tier_3_discount_percent ?? 10,
        tier4DiscountPercent: program.tier_4_discount_percent ?? 15,
        tierNames: {
          tier1: program.tier_1_name || 'Bronze',
          tier2: program.tier_2_name || 'Silver',
          tier3: program.tier_3_name || 'Gold',
          tier4: program.tier_4_name || 'Platinum',
        },
      },
    };
  }

  /**
   * Get or create member by external ID
   * Uses column names consistent with existing codebase:
   * - passkit_id (not pass_serial_number)
   * - source (not enrollment_source)
   * - points_balance (used alongside spend_total_cents if migration 025 applied)
   */
  async upsertMember(
    programId: string,
    externalId: string,
    customerData: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    },
    protocol: string = 'MEMBERSHIP'  // Default to MEMBERSHIP for backward compatibility
  ): Promise<{ member: MemberRecord; isNew: boolean }> {
    const client = this.getClient();

    console.log(`[POS Webhook] Looking up member by external_id: ${externalId} in program: ${programId}`);

    // Use * to select all columns and see what exists
    const { data: existing, error: findError } = await client
      .from("passes_master")
      .select("*")
      .eq("program_id", programId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (findError && findError.code !== 'PGRST116') {
      // Log full error for debugging
      console.error("[POS Webhook] Error looking up member:", JSON.stringify(findError, null, 2));
      
      // If column doesn't exist, this might be an older/different schema
      if (findError.code === '42703') {
        console.log("[POS Webhook] Database schema issue - columns may not exist");
        console.log("[POS Webhook] Please verify passes_master table structure and run migration 025");
      }
      throw new Error(`Database query error: ${findError.message}`);
    }
    
    // Debug: log what columns we got
    if (existing) {
      console.log("[POS Webhook] Found member columns:", Object.keys(existing));
    }

    if (existing) {
      console.log(`[POS Webhook] Found existing member: ${existing.id}`);
      
      // Try to fetch spend data if migration 025 columns exist
      let spendTotalCents = 0;
      let tierLevel: TierLevel = 'TIER_1';
      
      const { data: spendData, error: spendError } = await client
        .from("passes_master")
        .select("spend_total_cents, spend_tier_level")
        .eq("id", existing.id)
        .single();
      
      if (!spendError && spendData) {
        spendTotalCents = spendData.spend_total_cents || 0;
        tierLevel = (spendData.spend_tier_level as TierLevel) || 'TIER_1';
      }

      // Update missing customer data (only name fields)
      const updateData: Record<string, any> = {};
      if (customerData.firstName && !existing.first_name) updateData.first_name = customerData.firstName;
      if (customerData.lastName && !existing.last_name) updateData.last_name = customerData.lastName;

      if (Object.keys(updateData).length > 0) {
        await client
          .from("passes_master")
          .update(updateData)
          .eq("id", existing.id);
      }

      const passUrl = existing.passkit_id 
        ? `https://pub2.pskt.io/${existing.passkit_id}` 
        : null;

      return {
        member: {
          id: existing.id,
          externalId: existing.external_id,
          email: customerData.email || null,
          firstName: existing.first_name,
          lastName: existing.last_name,
          spendTotalCents,
          tierLevel,
          passSerialNumber: existing.passkit_id,
          passUrl,
          createdAt: new Date().toISOString(),
        },
        isNew: false,
      };
    }

    // Create new member with proper UUID format for Supabase
    const memberId = randomUUID();
    console.log(`[POS Webhook] Creating new member: ${memberId}`);
    
    // Insert with required columns for passes_master
    // Note: created_at has server default, don't include it
    // Note: passkit_internal_id is NOT NULL, must supply placeholder
    const insertData: Record<string, any> = {
      id: memberId,
      program_id: programId,
      external_id: externalId,
      status: 'ACTIVE',
      enrollment_source: 'POS_WEBHOOK',  // Column name from base schema (migration 005)
      protocol: protocol,                 // Protocol from program config (e.g., MEMBERSHIP, EVENT_TICKET, COUPON)
      passkit_internal_id: `pos_pending_${memberId}`,  // Placeholder until PassKit provisioning
      points_balance: 0,
    };

    // Add optional name/email fields (use first_name/last_name not member_*)
    if (customerData.firstName) insertData.first_name = customerData.firstName;
    if (customerData.lastName) insertData.last_name = customerData.lastName;
    if (customerData.email) insertData.email = customerData.email;

    const { data: newMember, error: insertError } = await client
      .from("passes_master")
      .insert(insertData)
      .select("id, external_id")
      .single();

    if (insertError) {
      console.error("[POS Webhook] Failed to create member:", insertError);
      
      // Provide helpful error message for schema issues
      if (insertError.code === 'PGRST204' || insertError.code === '42703') {
        console.log("[POS Webhook] The passes_master table may not have the expected schema.");
        console.log("[POS Webhook] Required columns: id, program_id, external_id, status, enrollment_source");
        console.log("[POS Webhook] Optional columns: first_name, last_name, spend_total_cents, spend_tier_level");
        throw new Error(
          "Database schema error: passes_master table missing required columns. " +
          "Please ensure the table has: id, program_id, external_id, status, enrollment_source columns. " +
          "Run migration 025 to add external_id and spend tracking columns."
        );
      }
      
      throw new Error(`Failed to create member record: ${insertError.message}`);
    }
    
    if (!newMember) {
      throw new Error("Failed to create member record: no data returned");
    }

    console.log(`[POS Webhook] Created new member: ${newMember.id}`);

    // Try to set spend tracking columns if they exist
    const { error: spendUpdateError } = await client
      .from("passes_master")
      .update({
        spend_total_cents: 0,
        spend_tier_level: 'TIER_1',
      })
      .eq("id", memberId);

    if (spendUpdateError) {
      console.log(`[POS Webhook] Note: spend columns may not exist yet: ${spendUpdateError.message}`);
    }

    return {
      member: {
        id: newMember.id,
        externalId: newMember.external_id,
        email: customerData.email || null,
        firstName: customerData.firstName || null,
        lastName: customerData.lastName || null,
        spendTotalCents: 0,
        tierLevel: 'TIER_1',
        passSerialNumber: null,
        passUrl: null,
        createdAt: new Date().toISOString(),
      },
      isNew: true,
    };
  }

  /**
   * Record spend transaction in ledger
   */
  async recordSpendTransaction(
    programId: string,
    memberId: string,
    transaction: POSWebhookTransaction,
    idempotencyKey?: string
  ): Promise<{ transactionId: string; isDuplicate: boolean }> {
    const client = this.getClient();
    const txId = transaction.transactionId || randomUUID();

    if (idempotencyKey) {
      const { data: existing } = await client
        .from("spend_ledger")
        .select("id")
        .eq("program_id", programId)
        .eq("idempotency_key", idempotencyKey)
        .single();

      if (existing) {
        console.log("[POS Webhook] Duplicate transaction detected:", idempotencyKey);
        return { transactionId: existing.id, isDuplicate: true };
      }
    }

    const { data: ledgerEntry, error } = await client
      .from("spend_ledger")
      .insert({
        id: txId,
        program_id: programId,
        member_id: memberId,
        external_transaction_id: transaction.transactionId,
        amount_cents: transaction.amountCents,
        currency: transaction.currency || 'USD',
        store_id: transaction.storeId,
        idempotency_key: idempotencyKey,
        metadata: transaction.metadata || {},
      })
      .select("id")
      .single();

    if (error) {
      console.error("[POS Webhook] Failed to record spend:", error);
      throw new Error("Failed to record spend transaction");
    }

    return { transactionId: ledgerEntry?.id || txId, isDuplicate: false };
  }

  /**
   * Update member spend total and tier
   * Note: Only updates columns that exist in migration 025
   * Falls back gracefully if spend columns don't exist yet
   */
  async updateMemberSpend(
    memberId: string,
    newSpendTotal: number,
    newTierLevel: TierLevel,
    passkitTierId?: string
  ): Promise<void> {
    const client = this.getClient();

    // Try updating spend columns (from migration 025)
    const spendUpdate: Record<string, any> = {
      spend_total_cents: newSpendTotal,
      spend_tier_level: newTierLevel,
    };

    const { error: spendError } = await client
      .from("passes_master")
      .update(spendUpdate)
      .eq("id", memberId);

    if (spendError) {
      // If columns don't exist, log warning but don't fail
      if (spendError.code === 'PGRST204' || spendError.code === '42703') {
        console.warn("[POS Webhook] Spend columns not found (migration 025 may not be applied):", spendError.message);
        console.warn("[POS Webhook] Spend tracking will not work until migration 025 is applied");
      } else {
        console.error("[POS Webhook] Failed to update spend:", spendError);
        throw new Error("Failed to update member spend total");
      }
    }

    // Separately try to update passkit_tier_id if provided (optional column)
    if (passkitTierId) {
      const { error: tierError } = await client
        .from("passes_master")
        .update({ passkit_tier_id: passkitTierId })
        .eq("id", memberId);

      if (tierError) {
        // Column may not exist in this schema version - just log warning
        console.warn("[POS Webhook] Could not update passkit_tier_id:", tierError.message);
      }
    }
  }

  /**
   * Get PassKit tier ID for a tier level
   */
  getPasskitTierIdForLevel(tierLevel: TierLevel, config: ProgramConfig): string | null {
    switch (tierLevel) {
      case 'TIER_4': return config.passkitTierPlatinumId || config.passkitTierId;
      case 'TIER_3': return config.passkitTierGoldId || config.passkitTierId;
      case 'TIER_2': return config.passkitTierSilverId || config.passkitTierId;
      case 'TIER_1': 
      default: return config.passkitTierBronzeId || config.passkitTierId;
    }
  }

  /**
   * Process a POS transaction
   */
  async processTransaction(
    programId: string,
    transaction: POSWebhookTransaction,
    idempotencyKey?: string
  ): Promise<POSWebhookResponse> {
    try {
      console.log(`[POS Webhook] Processing transaction for program ${programId}:`, {
        externalMemberId: transaction.externalMemberId,
        amountCents: transaction.amountCents,
        idempotencyKey,
      });

      const programConfig = await this.getProgramConfig(programId);
      if (!programConfig) {
        return {
          success: false,
          error: {
            code: "PROGRAM_NOT_FOUND",
            message: "Program configuration not found",
          },
        };
      }

      // External POS webhooks support all program protocols
      // Spend tracking works for MEMBERSHIP, EVENT_TICKET, and COUPON programs
      console.log(`[POS Webhook] Program protocol: ${programConfig.protocol}`);

      const { member, isNew } = await this.upsertMember(
        programId,
        transaction.externalMemberId,
        {
          email: transaction.customerEmail,
          firstName: transaction.customerFirstName,
          lastName: transaction.customerLastName,
          phone: transaction.customerPhone,
        },
        programConfig.protocol  // Pass protocol for new member creation
      );

      const { transactionId, isDuplicate } = await this.recordSpendTransaction(
        programId,
        member.id,
        transaction,
        idempotencyKey
      );

      if (isDuplicate) {
        const currentTierLevel = member.tierLevel;
        return {
          success: true,
          memberId: member.id,
          externalMemberId: transaction.externalMemberId,
          tierLevel: currentTierLevel,
          tierName: this.getTierName(currentTierLevel, programConfig.tierConfig),
          discountPercent: this.getDiscountForTier(currentTierLevel, programConfig.tierConfig),
          spendTotalCents: member.spendTotalCents,
          passUrl: member.passUrl || undefined,
          isNewMember: false,
          tierUpgraded: false,
          transactionId,
        };
      }

      const previousTierLevel = member.tierLevel;
      const newSpendTotal = member.spendTotalCents + transaction.amountCents;
      const newTierLevel = this.calculateSpendTier(newSpendTotal, programConfig.tierConfig);
      const tierUpgraded = this.compareTiers(newTierLevel, previousTierLevel) > 0;

      const passkitTierId = this.getPasskitTierIdForLevel(newTierLevel, programConfig);
      await this.updateMemberSpend(member.id, newSpendTotal, newTierLevel, passkitTierId || undefined);

      console.log(`[POS Webhook] Transaction processed:`, {
        memberId: member.id,
        previousTier: previousTierLevel,
        newTier: newTierLevel,
        tierUpgraded,
        spendTotal: newSpendTotal,
      });

      return {
        success: true,
        memberId: member.id,
        externalMemberId: transaction.externalMemberId,
        tierLevel: newTierLevel,
        tierName: this.getTierName(newTierLevel, programConfig.tierConfig),
        discountPercent: this.getDiscountForTier(newTierLevel, programConfig.tierConfig),
        spendTotalCents: newSpendTotal,
        passUrl: member.passUrl || programConfig.enrollmentUrl || undefined,
        isNewMember: isNew,
        tierUpgraded,
        previousTier: tierUpgraded ? this.getTierName(previousTierLevel, programConfig.tierConfig) : undefined,
        transactionId,
      };
    } catch (error) {
      console.error("[POS Webhook] Transaction processing error:", error);
      return {
        success: false,
        error: {
          code: "PROCESSING_ERROR",
          message: error instanceof Error ? error.message : "Failed to process transaction",
        },
      };
    }
  }

  /**
   * Compare tier levels (returns positive if tier1 > tier2)
   */
  private compareTiers(tier1: TierLevel, tier2: TierLevel): number {
    const order: Record<TierLevel, number> = {
      'TIER_1': 1,
      'TIER_2': 2,
      'TIER_3': 3,
      'TIER_4': 4,
    };
    return order[tier1] - order[tier2];
  }

  /**
   * Get member spend summary
   * Note: Uses columns that exist in the actual Supabase schema
   */
  async getMemberSpendSummary(
    programId: string,
    externalMemberId: string
  ): Promise<{
    found: boolean;
    member?: {
      id: string;
      externalId: string;
      spendTotalCents: number;
      tierLevel: TierLevel;
      tierName: string;
      discountPercent: number;
      passUrl: string | null;
    };
  }> {
    const client = this.getClient();
    const programConfig = await this.getProgramConfig(programId);

    if (!programConfig) {
      console.log("[POS Webhook] Program config not found for lookup:", programId);
      return { found: false };
    }

    // Use columns that exist in actual Supabase schema
    // passkit_internal_id can be used to construct pass URL if it's a valid PassKit ID
    const { data: member, error } = await client
      .from("passes_master")
      .select(`
        id,
        external_id,
        spend_total_cents,
        spend_tier_level,
        passkit_internal_id,
        install_url
      `)
      .eq("program_id", programId)
      .eq("external_id", externalMemberId)
      .single();

    if (error) {
      console.log("[POS Webhook] Member lookup error:", error.message);
      return { found: false };
    }

    if (!member) {
      console.log("[POS Webhook] Member not found:", externalMemberId);
      return { found: false };
    }

    const tierLevel = (member.spend_tier_level as TierLevel) || 'TIER_1';

    // Construct pass URL from install_url or passkit_internal_id
    let passUrl: string | null = member.install_url || null;
    if (!passUrl && member.passkit_internal_id && !member.passkit_internal_id.startsWith('pos_pending_')) {
      passUrl = `https://pub2.pskt.io/${member.passkit_internal_id}`;
    }

    return {
      found: true,
      member: {
        id: member.id,
        externalId: member.external_id,
        spendTotalCents: member.spend_total_cents || 0,
        tierLevel,
        tierName: this.getTierName(tierLevel, programConfig.tierConfig),
        discountPercent: this.getDiscountForTier(tierLevel, programConfig.tierConfig),
        passUrl,
      },
    };
  }
}

export const posWebhookService = new POSWebhookService();
