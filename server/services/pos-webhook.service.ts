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
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import { isSupabaseConfigured } from "../config/supabase";
import { TierLevel } from "../utils/tier-calculator";
import { POSWebhookTransaction, POSWebhookResponse } from "@shared/schema";
import { generate } from "short-uuid";

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
        passkit_tier_bronze_id,
        passkit_tier_silver_id,
        passkit_tier_gold_id,
        passkit_tier_platinum_id,
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
      passkitTierBronzeId: program.passkit_tier_bronze_id,
      passkitTierSilverId: program.passkit_tier_silver_id,
      passkitTierGoldId: program.passkit_tier_gold_id,
      passkitTierPlatinumId: program.passkit_tier_platinum_id,
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
   */
  async upsertMember(
    programId: string,
    externalId: string,
    customerData: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
    }
  ): Promise<{ member: MemberRecord; isNew: boolean }> {
    const client = this.getClient();

    const { data: existing, error: findError } = await client
      .from("passes_master")
      .select(`
        id,
        external_id,
        email,
        first_name,
        last_name,
        spend_total_cents,
        spend_tier_level,
        pass_serial_number,
        pass_url,
        created_at
      `)
      .eq("program_id", programId)
      .eq("external_id", externalId)
      .single();

    if (existing && !findError) {
      const updateData: Record<string, any> = {};
      if (customerData.email && !existing.email) updateData.email = customerData.email;
      if (customerData.firstName && !existing.first_name) updateData.first_name = customerData.firstName;
      if (customerData.lastName && !existing.last_name) updateData.last_name = customerData.lastName;

      if (Object.keys(updateData).length > 0) {
        await client
          .from("passes_master")
          .update(updateData)
          .eq("id", existing.id);
      }

      return {
        member: {
          id: existing.id,
          externalId: existing.external_id,
          email: existing.email,
          firstName: existing.first_name,
          lastName: existing.last_name,
          spendTotalCents: existing.spend_total_cents || 0,
          tierLevel: (existing.spend_tier_level as TierLevel) || 'TIER_1',
          passSerialNumber: existing.pass_serial_number,
          passUrl: existing.pass_url,
          createdAt: existing.created_at,
        },
        isNew: false,
      };
    }

    const memberId = generate();
    const { data: newMember, error: insertError } = await client
      .from("passes_master")
      .insert({
        id: memberId,
        program_id: programId,
        external_id: externalId,
        email: customerData.email || null,
        first_name: customerData.firstName || null,
        last_name: customerData.lastName || null,
        phone: customerData.phone || null,
        spend_total_cents: 0,
        spend_tier_level: 'TIER_1',
        status: 'ACTIVE',
        source: 'POS_WEBHOOK',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newMember) {
      console.error("[POS Webhook] Failed to create member:", insertError);
      throw new Error("Failed to create member record");
    }

    return {
      member: {
        id: newMember.id,
        externalId: newMember.external_id,
        email: newMember.email,
        firstName: newMember.first_name,
        lastName: newMember.last_name,
        spendTotalCents: 0,
        tierLevel: 'TIER_1',
        passSerialNumber: null,
        passUrl: null,
        createdAt: newMember.created_at,
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
    const txId = transaction.transactionId || generate();

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
        created_at: new Date().toISOString(),
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
   */
  async updateMemberSpend(
    memberId: string,
    newSpendTotal: number,
    newTierLevel: TierLevel,
    passkitTierId?: string
  ): Promise<void> {
    const client = this.getClient();

    const { error } = await client
      .from("passes_master")
      .update({
        spend_total_cents: newSpendTotal,
        spend_tier_level: newTierLevel,
        tier_level: newTierLevel,
        passkit_tier_id: passkitTierId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", memberId);

    if (error) {
      console.error("[POS Webhook] Failed to update member spend:", error);
      throw new Error("Failed to update member spend total");
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

      if (programConfig.protocol !== "MEMBERSHIP") {
        return {
          success: false,
          error: {
            code: "INVALID_PROTOCOL",
            message: "POS webhooks only supported for MEMBERSHIP programs",
          },
        };
      }

      const { member, isNew } = await this.upsertMember(
        programId,
        transaction.externalMemberId,
        {
          email: transaction.customerEmail,
          firstName: transaction.customerFirstName,
          lastName: transaction.customerLastName,
          phone: transaction.customerPhone,
        }
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
      return { found: false };
    }

    const { data: member, error } = await client
      .from("passes_master")
      .select(`
        id,
        external_id,
        spend_total_cents,
        spend_tier_level,
        pass_url
      `)
      .eq("program_id", programId)
      .eq("external_id", externalMemberId)
      .single();

    if (error || !member) {
      return { found: false };
    }

    const tierLevel = (member.spend_tier_level as TierLevel) || 'TIER_1';

    return {
      found: true,
      member: {
        id: member.id,
        externalId: member.external_id,
        spendTotalCents: member.spend_total_cents || 0,
        tierLevel,
        tierName: this.getTierName(tierLevel, programConfig.tierConfig),
        discountPercent: this.getDiscountForTier(tierLevel, programConfig.tierConfig),
        passUrl: member.pass_url,
      },
    };
  }
}

export const posWebhookService = new POSWebhookService();
