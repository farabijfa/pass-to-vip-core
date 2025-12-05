import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import { passKitService } from "./passkit.service";

const BATCH_SIZE = 50;
const RATE_LIMIT_DELAY_MS = 200;

type ProtocolType = "MEMBERSHIP" | "COUPON" | "EVENT_TICKET";

type MembershipSegment = "ALL" | "TIER_BRONZE" | "TIER_SILVER" | "TIER_GOLD" | "TIER_PLATINUM" | "VIP" | "DORMANT" | "GEO" | "CSV";
type CouponSegment = "ALL_ACTIVE" | "UNREDEEMED" | "EXPIRING_SOON" | "GEO" | "CSV";
type EventTicketSegment = "ALL_TICKETED" | "NOT_CHECKED_IN" | "CHECKED_IN" | "GEO" | "CSV";
type SegmentType = MembershipSegment | CouponSegment | EventTicketSegment;

interface ProgramInfo {
  id: string;
  name: string;
  protocol: ProtocolType;
  passkit_program_id: string;
  tenant_id: string;
  tier_bronze_max: number;
  tier_silver_max: number;
  tier_gold_max: number;
}

interface TripleValidation {
  tenantId: string;
  programId: string;
  protocol: ProtocolType;
}

interface PassRecord {
  id: string;
  passkit_internal_id: string;
  passkit_program_id: string;
  tier_points: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface BirthdayUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  passkit_internal_id: string;
  passkit_program_id: string;
}

interface BroadcastOptions {
  tenantId: string;
  programId: string;
  protocol: ProtocolType;
  message: string;
  segment?: SegmentType;
  segmentConfig?: {
    vipThreshold?: number;
    dormantDays?: number;
    zipCodes?: string[];
    memberIds?: string[];
  };
  campaignName?: string;
  dryRun?: boolean;
}

interface BroadcastResult {
  success: boolean;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  campaignLogId?: string;
  error?: string;
  dryRun?: boolean;
  messagePreview?: string;
  targetSegment?: string;
  segmentDescription?: string;
  protocol?: ProtocolType;
  sampleRecipients?: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    externalId?: string;
    pointsBalance?: number;
    tierPoints?: number;
    lastUpdated?: string;
  }>;
}

interface BirthdayBotResult {
  success: boolean;
  processed: number;
  successCount: number;
  failedCount: number;
  alreadyGifted: number;
  programsProcessed: number;
  campaignLogId?: string;
  error?: string;
  dryRun?: boolean;
  details?: BirthdayDetail[];
}

interface BirthdayDetail {
  passId: string;
  email: string;
  firstName: string;
  lastName: string;
  programName: string;
  pointsAwarded: number;
  status: "success" | "skipped" | "failed";
  reason?: string;
}

interface ProgramConfig {
  id: string;
  name: string;
  passkit_program_id: string;
  birthday_bot_enabled: boolean;
  birthday_reward_points: number;
  birthday_message: string;
}

interface EligiblePass {
  id: string;
  passkit_internal_id: string;
  passkit_program_id: string;
  email: string;
  first_name: string;
  last_name: string;
  user_id: string;
  birth_date: string;
}

interface SegmentDefinition {
  type: SegmentType;
  name: string;
  description: string;
  icon: string;
  estimatedCount?: number;
  requiresConfig?: boolean;
  configType?: "vipThreshold" | "dormantDays" | "zipCodes" | "memberIds";
}

interface SegmentStats {
  segment: SegmentType;
  description: string;
  count: number;
  protocol: ProtocolType;
  sampleMembers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    pointsBalance?: number;
    tierPoints?: number;
    lastUpdated?: string;
    zipCode?: string;
  }>;
}

class NotificationService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured.");
      }
      this.client = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey
      );
    }
    return this.client;
  }

  async validateTriple(
    tenantId: string,
    programId: string,
    protocol: ProtocolType
  ): Promise<{ valid: boolean; program?: ProgramInfo; error?: string }> {
    try {
      const client = this.getClient();

      const { data: programs, error } = await client
        .from("programs")
        .select(`
          id,
          name,
          protocol,
          passkit_program_id,
          tenant_id,
          tier_bronze_max,
          tier_silver_max,
          tier_gold_max
        `)
        .eq("tenant_id", tenantId)
        .eq("passkit_program_id", programId)
        .limit(1);

      if (error) {
        return { valid: false, error: `Database error: ${error.message}` };
      }

      const program = programs?.[0];

      if (!program) {
        return {
          valid: false,
          error: `Program not found for tenant ${tenantId} with PassKit ID ${programId}`,
        };
      }

      if (program.protocol !== protocol) {
        return {
          valid: false,
          error: `Protocol mismatch: Program is ${program.protocol}, but request specified ${protocol}`,
        };
      }

      return {
        valid: true,
        program: {
          ...program,
          tier_bronze_max: program.tier_bronze_max ?? 999,
          tier_silver_max: program.tier_silver_max ?? 4999,
          tier_gold_max: program.tier_gold_max ?? 14999,
        } as ProgramInfo,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Unknown validation error",
      };
    }
  }

  getSegmentsForProtocol(protocol: ProtocolType): SegmentDefinition[] {
    const commonSegments: SegmentDefinition[] = [
      {
        type: "GEO",
        name: "Geographic",
        description: "Target by ZIP code",
        icon: "MapPin",
        requiresConfig: true,
        configType: "zipCodes",
      },
      {
        type: "CSV",
        name: "Upload List",
        description: "Target specific IDs from CSV",
        icon: "FileSpreadsheet",
        requiresConfig: true,
        configType: "memberIds",
      },
    ];

    switch (protocol) {
      case "MEMBERSHIP":
        return [
          { type: "ALL", name: "All Members", description: "All active members", icon: "Users" },
          { type: "TIER_BRONZE", name: "Bronze Tier", description: "Bronze tier members", icon: "Medal" },
          { type: "TIER_SILVER", name: "Silver Tier", description: "Silver tier members", icon: "Award" },
          { type: "TIER_GOLD", name: "Gold Tier", description: "Gold tier members", icon: "Star" },
          { type: "TIER_PLATINUM", name: "Platinum Tier", description: "Platinum tier members", icon: "Crown" },
          { type: "VIP", name: "VIP (Points)", description: "High-value by points", icon: "Gem", requiresConfig: true, configType: "vipThreshold" },
          { type: "DORMANT", name: "Dormant", description: "Inactive members", icon: "Clock", requiresConfig: true, configType: "dormantDays" },
          ...commonSegments,
        ];

      case "COUPON":
        return [
          { type: "ALL_ACTIVE", name: "All Active", description: "All unredeemed coupons", icon: "Ticket" },
          { type: "UNREDEEMED", name: "Unredeemed", description: "Not yet used", icon: "TicketCheck" },
          { type: "EXPIRING_SOON", name: "Expiring Soon", description: "Expires within 7 days", icon: "AlertTriangle" },
          ...commonSegments,
        ];

      case "EVENT_TICKET":
        return [
          { type: "ALL_TICKETED", name: "All Ticket Holders", description: "All event attendees", icon: "Users" },
          { type: "NOT_CHECKED_IN", name: "Not Checked In", description: "Awaiting arrival", icon: "UserX" },
          { type: "CHECKED_IN", name: "Checked In", description: "Already at venue", icon: "UserCheck" },
          ...commonSegments,
        ];

      default:
        return commonSegments;
    }
  }

  private getSegmentDescription(
    segment: SegmentType,
    protocol: ProtocolType,
    segmentConfig?: BroadcastOptions["segmentConfig"],
    program?: ProgramInfo
  ): string {
    switch (segment) {
      case "ALL":
        return "All active members with installed passes";
      case "TIER_BRONZE":
        return `Bronze tier (0-${program?.tier_bronze_max || 999} points)`;
      case "TIER_SILVER":
        return `Silver tier (${(program?.tier_bronze_max || 999) + 1}-${program?.tier_silver_max || 4999} points)`;
      case "TIER_GOLD":
        return `Gold tier (${(program?.tier_silver_max || 4999) + 1}-${program?.tier_gold_max || 14999} points)`;
      case "TIER_PLATINUM":
        return `Platinum tier (${(program?.tier_gold_max || 14999) + 1}+ points)`;
      case "VIP":
        return `High-value members (${segmentConfig?.vipThreshold || 500}+ points)`;
      case "DORMANT":
        return `Inactive members (no activity for ${segmentConfig?.dormantDays || 30}+ days)`;
      case "GEO":
        const zips = segmentConfig?.zipCodes?.join(", ") || "specified ZIP codes";
        return `Members in ZIP codes: ${zips}`;
      case "CSV":
        return `Targeted list (${segmentConfig?.memberIds?.length || 0} member IDs)`;
      case "ALL_ACTIVE":
        return "All active unredeemed coupons";
      case "UNREDEEMED":
        return "Coupons not yet redeemed";
      case "EXPIRING_SOON":
        return "Coupons expiring within 7 days";
      case "ALL_TICKETED":
        return "All ticket holders";
      case "NOT_CHECKED_IN":
        return "Ticket holders not yet checked in";
      case "CHECKED_IN":
        return "Ticket holders already checked in";
      default:
        return "Custom segment";
    }
  }

  async getSegmentPreview(
    tenantId: string,
    programId: string,
    protocol: ProtocolType,
    segment: SegmentType,
    segmentConfig?: BroadcastOptions["segmentConfig"]
  ): Promise<{ success: boolean; stats?: SegmentStats; error?: string }> {
    try {
      const validation = await this.validateTriple(tenantId, programId, protocol);
      if (!validation.valid || !validation.program) {
        return { success: false, error: validation.error };
      }

      const client = this.getClient();
      const program = validation.program;

      const passes = await this.getTargetedPasses(
        client,
        program,
        segment,
        segmentConfig
      );

      const sampleMembers = passes.slice(0, 10).map((pass: any) => ({
        id: pass.id,
        email: pass.users?.email || pass.email || "unknown",
        firstName: pass.users?.first_name || pass.first_name || "Unknown",
        lastName: pass.users?.last_name || pass.last_name || "",
        pointsBalance: pass.protocol_membership?.points_balance,
        tierPoints: pass.protocol_membership?.tier_points,
        lastUpdated: pass.last_updated,
        zipCode: pass.users?.zip,
      }));

      return {
        success: true,
        stats: {
          segment,
          description: this.getSegmentDescription(segment, protocol, segmentConfig, program),
          count: passes.length,
          protocol,
          sampleMembers,
        },
      };
    } catch (error) {
      console.error("Segment preview error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async getTargetedPasses(
    client: SupabaseClient,
    program: ProgramInfo,
    segment: SegmentType,
    segmentConfig?: BroadcastOptions["segmentConfig"]
  ): Promise<any[]> {
    const baseQuery = `
      id,
      passkit_internal_id,
      external_id,
      email,
      first_name,
      last_name,
      last_updated,
      protocol,
      programs:program_id (
        passkit_program_id
      ),
      users:user_id (
        email,
        first_name,
        last_name,
        zip
      ),
      protocol_membership (
        points_balance,
        tier_points,
        lifetime_points
      ),
      protocol_coupon (
        offer_details,
        expiry_date,
        redeemed_at
      ),
      protocol_event_ticket (
        event_name,
        venue,
        checked_in_at
      )
    `;

    let query = client
      .from("passes_master")
      .select(baseQuery)
      .eq("program_id", program.id)
      .eq("protocol", program.protocol)
      .eq("status", "INSTALLED")
      .eq("is_active", true);

    const { data: allPasses, error } = await query;

    if (error) {
      throw new Error(`Database query error: ${error.message}`);
    }

    if (!allPasses || allPasses.length === 0) {
      return [];
    }

    switch (segment) {
      case "ALL":
        return allPasses;

      case "TIER_BRONZE": {
        return allPasses.filter((pass: any) => {
          const tierPoints = pass.protocol_membership?.tier_points || 0;
          return tierPoints <= program.tier_bronze_max;
        });
      }

      case "TIER_SILVER": {
        return allPasses.filter((pass: any) => {
          const tierPoints = pass.protocol_membership?.tier_points || 0;
          return tierPoints > program.tier_bronze_max && tierPoints <= program.tier_silver_max;
        });
      }

      case "TIER_GOLD": {
        return allPasses.filter((pass: any) => {
          const tierPoints = pass.protocol_membership?.tier_points || 0;
          return tierPoints > program.tier_silver_max && tierPoints <= program.tier_gold_max;
        });
      }

      case "TIER_PLATINUM": {
        return allPasses.filter((pass: any) => {
          const tierPoints = pass.protocol_membership?.tier_points || 0;
          return tierPoints > program.tier_gold_max;
        });
      }

      case "VIP": {
        const threshold = segmentConfig?.vipThreshold || 500;
        return allPasses.filter((pass: any) => {
          const points = pass.protocol_membership?.points_balance || 0;
          return points >= threshold;
        });
      }

      case "DORMANT": {
        const days = segmentConfig?.dormantDays || 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        return allPasses.filter((pass: any) => {
          if (!pass.last_updated) return true;
          const lastUpdated = new Date(pass.last_updated);
          return lastUpdated < cutoffDate;
        });
      }

      case "GEO": {
        const zipCodes = segmentConfig?.zipCodes || [];
        if (zipCodes.length === 0) return allPasses;

        return allPasses.filter((pass: any) => {
          const userZip = pass.users?.zip || "";
          return zipCodes.some((zip) => userZip.startsWith(zip));
        });
      }

      case "CSV": {
        const memberIds = segmentConfig?.memberIds || [];
        if (memberIds.length === 0) return [];

        const memberIdSet = new Set(memberIds.map((id) => id.toLowerCase().trim()));
        return allPasses.filter((pass: any) => {
          const externalId = (pass.external_id || "").toLowerCase().trim();
          const passId = (pass.id || "").toLowerCase().trim();
          return memberIdSet.has(externalId) || memberIdSet.has(passId);
        });
      }

      case "ALL_ACTIVE":
      case "UNREDEEMED": {
        return allPasses.filter((pass: any) => {
          return pass.protocol_coupon && !pass.protocol_coupon.redeemed_at;
        });
      }

      case "EXPIRING_SOON": {
        const now = new Date();
        const weekFromNow = new Date();
        weekFromNow.setDate(now.getDate() + 7);

        return allPasses.filter((pass: any) => {
          if (!pass.protocol_coupon?.expiry_date) return false;
          const expiryDate = new Date(pass.protocol_coupon.expiry_date);
          return expiryDate >= now && expiryDate <= weekFromNow && !pass.protocol_coupon.redeemed_at;
        });
      }

      case "ALL_TICKETED": {
        return allPasses.filter((pass: any) => pass.protocol_event_ticket);
      }

      case "NOT_CHECKED_IN": {
        return allPasses.filter((pass: any) => {
          return pass.protocol_event_ticket && !pass.protocol_event_ticket.checked_in_at;
        });
      }

      case "CHECKED_IN": {
        return allPasses.filter((pass: any) => {
          return pass.protocol_event_ticket && pass.protocol_event_ticket.checked_in_at;
        });
      }

      default:
        return allPasses;
    }
  }

  async sendBroadcast(options: BroadcastOptions): Promise<BroadcastResult> {
    const {
      tenantId,
      programId,
      protocol,
      message,
      segment = "ALL",
      segmentConfig,
      campaignName,
      dryRun = false,
    } = options;

    console.log(`📢 Broadcast Request${dryRun ? " [DRY RUN]" : ""}`);
    console.log(`   Tenant: ${tenantId}`);
    console.log(`   Program: ${programId}`);
    console.log(`   Protocol: ${protocol}`);
    console.log(`   Message: "${message}"`);
    console.log(`   Segment: ${segment}`);
    if (segmentConfig) {
      console.log(`   Config: ${JSON.stringify(segmentConfig)}`);
    }
    if (dryRun) {
      console.log("   DRY RUN MODE - No messages will be sent");
    }

    try {
      if (!message || message.trim().length < 5) {
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: "Message too short (minimum 5 characters required)",
        };
      }

      const validation = await this.validateTriple(tenantId, programId, protocol);
      if (!validation.valid || !validation.program) {
        console.error(`Triple validation failed: ${validation.error}`);
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: validation.error,
        };
      }

      const program = validation.program;
      console.log(`   Validated program: ${program.name} (${program.id})`);

      const client = this.getClient();
      const passes = await this.getTargetedPasses(client, program, segment, segmentConfig);

      if (passes.length === 0) {
        console.log("No members found for this segment");
        return {
          success: true,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          dryRun,
          messagePreview: message,
          targetSegment: segment,
          protocol,
          segmentDescription: this.getSegmentDescription(segment, protocol, segmentConfig, program),
        };
      }

      console.log(`Found ${passes.length} eligible recipients for ${segment} segment`);

      if (dryRun) {
        const sampleRecipients = passes.slice(0, 5).map((pass: any) => ({
          id: pass.id,
          externalId: pass.external_id,
          email: pass.users?.email || pass.email || "unknown",
          firstName: pass.users?.first_name || pass.first_name || "Unknown",
          lastName: pass.users?.last_name || pass.last_name || "",
          pointsBalance: pass.protocol_membership?.points_balance,
          tierPoints: pass.protocol_membership?.tier_points,
          lastUpdated: pass.last_updated,
        }));

        console.log(`Dry run complete - ${passes.length} would receive the message`);

        return {
          success: true,
          totalRecipients: passes.length,
          successCount: 0,
          failedCount: 0,
          dryRun: true,
          messagePreview: message,
          targetSegment: segment,
          protocol,
          segmentDescription: this.getSegmentDescription(segment, protocol, segmentConfig, program),
          sampleRecipients,
        };
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < passes.length; i += BATCH_SIZE) {
        const batch = passes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(passes.length / BATCH_SIZE);
        console.log(`Processing batch ${batchNum} of ${totalBatches} (${batch.length} recipients)`);

        const results = await Promise.all(
          batch.map(async (pass: any) => {
            try {
              const passkitProgramId = pass.programs?.passkit_program_id || program.passkit_program_id;
              const result = await passKitService.pushMessage(
                pass.passkit_internal_id,
                passkitProgramId,
                message
              );
              return result.success;
            } catch (error) {
              const email = pass.users?.email || pass.email || pass.external_id;
              console.error(`   Failed to send to ${email}:`, error);
              return false;
            }
          })
        );

        successCount += results.filter((r) => r === true).length;
        failedCount += results.filter((r) => r === false).length;

        if (i + BATCH_SIZE < passes.length) {
          await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
        }
      }

      const { data: logData, error: logError } = await client
        .from("notification_logs")
        .insert({
          program_id: program.id,
          campaign_name: campaignName || `${segment} Broadcast`,
          recipient_count: passes.length,
          success_count: successCount,
          failed_count: failedCount,
          message_content: message,
          target_segment: segment,
        })
        .select("id")
        .single();

      if (logError) {
        console.error("Failed to log campaign:", logError.message);
      }

      console.log(`Broadcast complete: ${successCount} success, ${failedCount} failed`);

      return {
        success: true,
        totalRecipients: passes.length,
        successCount,
        failedCount,
        campaignLogId: logData?.id,
        dryRun: false,
        messagePreview: message,
        targetSegment: segment,
        protocol,
        segmentDescription: this.getSegmentDescription(segment, protocol, segmentConfig, program),
      };
    } catch (error) {
      console.error("Broadcast error:", error);
      return {
        success: false,
        totalRecipients: 0,
        successCount: 0,
        failedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async sendToMemberIds(
    tenantId: string,
    programId: string,
    protocol: ProtocolType,
    memberIds: string[],
    message: string,
    campaignName?: string,
    dryRun = false
  ): Promise<BroadcastResult> {
    return this.sendBroadcast({
      tenantId,
      programId,
      protocol,
      message,
      segment: "CSV",
      segmentConfig: { memberIds },
      campaignName: campaignName || "Targeted Campaign (CSV)",
      dryRun,
    });
  }

  async runBirthdayBot(options: { dryRun?: boolean; testDate?: string } = {}): Promise<BirthdayBotResult> {
    const { dryRun = false, testDate } = options;

    console.log(`Running Birthday Bot (Configuration-Driven)${dryRun ? " [DRY RUN]" : ""}...`);

    const today = testDate ? new Date(testDate) : new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();
    console.log(`   Looking for birthdays: Month ${month}, Day ${day}, Year ${year}`);
    if (dryRun) {
      console.log("   DRY RUN MODE - No actual changes will be made");
    }

    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalAlreadyGifted = 0;
    let programsProcessed = 0;
    const details: BirthdayDetail[] = [];

    try {
      const client = this.getClient();

      const { data: programs, error: programError } = await client
        .from("programs")
        .select("id, name, passkit_program_id, birthday_bot_enabled, birthday_reward_points, birthday_message, protocol")
        .eq("birthday_bot_enabled", true)
        .eq("protocol", "MEMBERSHIP");

      if (programError) {
        console.error("Failed to query programs:", programError.message);
        return {
          success: false,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          alreadyGifted: 0,
          programsProcessed: 0,
          error: programError.message,
        };
      }

      if (!programs || programs.length === 0) {
        console.log("No MEMBERSHIP programs have birthday bot enabled");
        return {
          success: true,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          alreadyGifted: 0,
          programsProcessed: 0,
        };
      }

      console.log(`Found ${programs.length} MEMBERSHIP programs with birthday bot enabled`);

      for (const program of programs as ProgramConfig[]) {
        console.log(`\nProcessing program: ${program.name} (${program.passkit_program_id})`);
        console.log(`   Reward: ${program.birthday_reward_points} points`);
        console.log(`   Message: "${program.birthday_message}"`);

        const { data: passes, error: passError } = await client
          .from("passes_master")
          .select(`
            id,
            passkit_internal_id,
            program_id,
            email,
            first_name,
            last_name,
            user_id,
            users!inner (
              id,
              birth_date
            )
          `)
          .eq("program_id", program.id)
          .eq("status", "INSTALLED")
          .eq("is_active", true)
          .eq("protocol", "MEMBERSHIP")
          .not("users.birth_date", "is", null);

        if (passError) {
          console.error(`   Failed to query passes for ${program.name}:`, passError.message);
          continue;
        }

        if (!passes || passes.length === 0) {
          console.log(`   No passes with birth dates found for ${program.name}`);
          continue;
        }

        const eligiblePasses = passes
          .filter((pass: any) => {
            const user = pass.users;
            if (!user?.birth_date) return false;
            const birthDate = new Date(user.birth_date);
            return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
          })
          .map((pass: any) => ({
            ...pass,
            birth_date: pass.users.birth_date,
            user_id: pass.users.id,
          }));

        if (eligiblePasses.length === 0) {
          console.log(`   No birthdays today for ${program.name}`);
          continue;
        }

        console.log(`   Found ${eligiblePasses.length} birthdays today!`);
        programsProcessed++;

        for (const pass of eligiblePasses as EligiblePass[]) {
          totalProcessed++;
          const detail: BirthdayDetail = {
            passId: pass.id,
            email: pass.email || "unknown",
            firstName: pass.first_name || "Unknown",
            lastName: pass.last_name || "",
            programName: program.name,
            pointsAwarded: program.birthday_reward_points,
            status: "failed",
          };

          try {
            if (dryRun) {
              console.log(
                `   [DRY RUN] Would gift ${pass.first_name} ${pass.last_name} (${pass.email}) - ${program.birthday_reward_points} points`
              );
              detail.status = "success";
              detail.reason = "Dry run - would be processed";
              details.push(detail);
              totalSuccess++;
              continue;
            }

            const { data: logResult, error: logError } = await client
              .from("birthday_logs")
              .upsert(
                {
                  pass_id: pass.id,
                  program_id: program.id,
                  year,
                  points_awarded: program.birthday_reward_points,
                },
                { onConflict: "pass_id,year", ignoreDuplicates: true }
              )
              .select("id")
              .single();

            if (logError && logError.code !== "23505") {
              console.error(`   Failed to log birthday for ${pass.email}:`, logError.message);
              detail.reason = `Log error: ${logError.message}`;
              details.push(detail);
              totalFailed++;
              continue;
            }

            if (!logResult) {
              console.log(`   Skipping ${pass.first_name} ${pass.last_name} - already gifted this year`);
              detail.status = "skipped";
              detail.reason = "Already gifted this year";
              details.push(detail);
              totalAlreadyGifted++;
              continue;
            }

            const { error: rpcError } = await client.rpc("process_membership_transaction", {
              p_member_id: pass.user_id || pass.id,
              p_transaction_type: "EARN",
              p_points: program.birthday_reward_points,
              p_description: "Birthday Bonus",
              p_metadata: { source: "birthday_bot", program_id: program.id },
            });

            if (rpcError) {
              console.error(`   Failed to award points to ${pass.email}:`, rpcError.message);
              await client.from("birthday_logs").delete().eq("id", logResult.id);
              detail.reason = `RPC error: ${rpcError.message}`;
              details.push(detail);
              totalFailed++;
              continue;
            }

            if (pass.passkit_internal_id && pass.passkit_program_id) {
              await passKitService.pushMessage(
                pass.passkit_internal_id,
                pass.passkit_program_id,
                program.birthday_message
              );
            }

            console.log(`   Awarded ${program.birthday_reward_points} points to ${pass.first_name} ${pass.last_name}`);
            detail.status = "success";
            detail.reason = "Points awarded and notification sent";
            details.push(detail);
            totalSuccess++;
          } catch (error) {
            console.error(`   Error processing ${pass.email}:`, error);
            detail.reason = `Error: ${error instanceof Error ? error.message : "Unknown"}`;
            details.push(detail);
            totalFailed++;
          }
        }
      }

      let campaignLogId: string | undefined;

      if (!dryRun) {
        const { data: logData, error: logError } = await client
          .from("notification_logs")
          .insert({
            campaign_name: "Birthday Bot (Multi-Program)",
            recipient_count: totalProcessed,
            success_count: totalSuccess,
            failed_count: totalFailed,
            message_content: `Processed ${programsProcessed} programs, ${totalAlreadyGifted} already gifted`,
            target_segment: "BIRTHDAY",
          })
          .select("id")
          .single();

        if (logError) {
          console.error("Failed to log birthday campaign:", logError.message);
        }
        campaignLogId = logData?.id;
      }

      console.log(`\nBirthday Bot complete${dryRun ? " [DRY RUN]" : ""}:`);
      console.log(`   Programs: ${programsProcessed}`);
      console.log(`   Processed: ${totalProcessed}`);
      console.log(`   Success: ${totalSuccess}`);
      console.log(`   Failed: ${totalFailed}`);
      console.log(`   Already gifted: ${totalAlreadyGifted}`);

      return {
        success: true,
        processed: totalProcessed,
        successCount: totalSuccess,
        failedCount: totalFailed,
        alreadyGifted: totalAlreadyGifted,
        programsProcessed,
        campaignLogId,
        dryRun,
        details: dryRun ? details : undefined,
      };
    } catch (error) {
      console.error("Birthday Bot error:", error);
      return {
        success: false,
        processed: totalProcessed,
        successCount: totalSuccess,
        failedCount: totalFailed,
        alreadyGifted: totalAlreadyGifted,
        programsProcessed,
        error: error instanceof Error ? error.message : "Unknown error",
        dryRun,
        details: dryRun ? details : undefined,
      };
    }
  }

  async getCampaignLogs(
    programId?: string,
    limit = 50
  ): Promise<{ success: boolean; logs?: any[]; error?: string }> {
    try {
      const client = this.getClient();

      let query = client
        .from("notification_logs")
        .select(`
          *,
          programs:program_id (
            name,
            passkit_program_id,
            protocol
          )
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (programId) {
        const { data: programs } = await client
          .from("programs")
          .select("id")
          .eq("passkit_program_id", programId)
          .limit(1);

        if (programs?.[0]) {
          query = query.eq("program_id", programs[0].id);
        }
      }

      const { data, error } = await query;

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, logs: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getAvailableSegments(
    tenantId: string,
    programId: string,
    protocol: ProtocolType
  ): Promise<{
    success: boolean;
    segments?: SegmentDefinition[];
    tierThresholds?: {
      bronze: number;
      silver: number;
      gold: number;
    };
    error?: string;
  }> {
    try {
      const validation = await this.validateTriple(tenantId, programId, protocol);
      if (!validation.valid || !validation.program) {
        return { success: false, error: validation.error };
      }

      const segments = this.getSegmentsForProtocol(protocol);

      const client = this.getClient();
      const program = validation.program;

      for (const segment of segments) {
        if (!segment.requiresConfig && segment.type !== "GEO" && segment.type !== "CSV") {
          try {
            const passes = await this.getTargetedPasses(client, program, segment.type, {});
            segment.estimatedCount = passes.length;
          } catch {
            segment.estimatedCount = undefined;
          }
        }
      }

      return {
        success: true,
        segments,
        tierThresholds: protocol === "MEMBERSHIP" ? {
          bronze: program.tier_bronze_max,
          silver: program.tier_silver_max,
          gold: program.tier_gold_max,
        } : undefined,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const notificationService = new NotificationService();
