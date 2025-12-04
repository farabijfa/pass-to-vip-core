import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import { passKitService } from "./passkit.service";

const BATCH_SIZE = 50;

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
  programId: string;
  message: string;
  segment?: "ALL" | "VIP";
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
  sampleRecipients?: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
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

  private async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>
  ): Promise<{ results: R[]; successCount: number; failedCount: number }> {
    const results: R[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(items.length / BATCH_SIZE)} (${batch.length} items)`);

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            const result = await processor(item);
            successCount++;
            return result;
          } catch (error) {
            failedCount++;
            console.error("Batch item failed:", error);
            return null as unknown as R;
          }
        })
      );

      results.push(...batchResults);

      if (i + BATCH_SIZE < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return { results, successCount, failedCount };
  }

  async sendBroadcast(options: BroadcastOptions): Promise<BroadcastResult> {
    const { programId, message, segment = "ALL", campaignName, dryRun = false } = options;
    
    console.log(`📢 Broadcast Request${dryRun ? " [DRY RUN]" : ""}`);
    console.log(`   Program: ${programId}`);
    console.log(`   Message: "${message}"`);
    console.log(`   Segment: ${segment}`);
    if (dryRun) {
      console.log("   ⚠️ DRY RUN MODE - No messages will be sent");
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

      if (!programId || programId.trim().length === 0) {
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: "Program ID is required",
        };
      }

      const client = this.getClient();

      // First, lookup the program by passkit_program_id to get internal ID
      // Use .limit(1) instead of .single() to handle multiple programs with same passkit_program_id
      const { data: programs, error: programError } = await client
        .from("programs")
        .select("id, passkit_program_id")
        .eq("passkit_program_id", programId)
        .limit(1);

      const program = programs?.[0];

      if (programError || !program) {
        console.error("❌ Program not found:", programError?.message || "No program with this ID");
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: `Program not found: ${programId}`,
        };
      }

      console.log(`   Found program: ${program.id} (PassKit: ${program.passkit_program_id})`);

      // Query passes_master using program_id (internal ID) and join to get passkit_program_id
      // Status should be "INSTALLED" (not "ACTIVE") and is_active should be true
      // Note: tier_points is in protocol_membership, not passes_master - VIP filtering removed for now
      let query = client
        .from("passes_master")
        .select(`
          id,
          passkit_internal_id,
          external_id,
          programs:program_id (
            passkit_program_id
          ),
          users:user_id (
            email,
            first_name,
            last_name
          )
        `)
        .eq("program_id", program.id)
        .eq("status", "INSTALLED")
        .eq("is_active", true);

      // TODO: VIP segment filtering needs to join protocol_membership table
      if (segment === "VIP") {
        console.log("   ⚠️ VIP filtering not implemented - processing all members");
      }

      const { data: passes, error: queryError } = await query;

      if (queryError) {
        console.error("❌ Failed to query passes:", queryError.message);
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: `Database error: ${queryError.message}`,
        };
      }

      if (!passes || passes.length === 0) {
        console.log("⚠️ No active passes found for this program/segment");
        return {
          success: true,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          dryRun,
          messagePreview: message,
          targetSegment: segment,
        };
      }

      console.log(`📬 Found ${passes.length} eligible recipients`);

      if (dryRun) {
        const sampleRecipients = passes.slice(0, 5).map((pass: any) => ({
          id: pass.id,
          externalId: pass.external_id,
          email: pass.users?.email || "unknown",
          firstName: pass.users?.first_name || "Unknown",
          lastName: pass.users?.last_name || "",
        }));

        console.log(`✅ Dry run complete - ${passes.length} would receive the message`);
        console.log(`   Sample recipients: ${sampleRecipients.map(r => r.externalId || r.email).join(", ")}`);

        return {
          success: true,
          totalRecipients: passes.length,
          successCount: 0,
          failedCount: 0,
          dryRun: true,
          messagePreview: message,
          targetSegment: segment,
          sampleRecipients,
        };
      }

      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < passes.length; i += BATCH_SIZE) {
        const batch = passes.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(passes.length / BATCH_SIZE);
        console.log(`📦 Processing batch ${batchNum} of ${totalBatches} (${batch.length} recipients)`);

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
              console.error(`   ❌ Failed to send to ${pass.email}:`, error);
              return false;
            }
          })
        );

        successCount += results.filter((r) => r === true).length;
        failedCount += results.filter((r) => r === false).length;

        if (i + BATCH_SIZE < passes.length) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      const { data: logData, error: logError } = await client
        .from("notification_logs")
        .insert({
          program_id: program.id,
          campaign_name: campaignName || "Manual Broadcast",
          recipient_count: passes.length,
          success_count: successCount,
          failed_count: failedCount,
          message_content: message,
          target_segment: segment,
          status: "COMPLETED",
        })
        .select("id")
        .single();

      if (logError) {
        console.error("⚠️ Failed to log campaign:", logError.message);
      }

      console.log(`✅ Broadcast complete: ${successCount} success, ${failedCount} failed`);

      return {
        success: true,
        totalRecipients: passes.length,
        successCount,
        failedCount,
        campaignLogId: logData?.id,
        dryRun: false,
        messagePreview: message,
        targetSegment: segment,
      };

    } catch (error) {
      console.error("❌ Broadcast error:", error);
      return {
        success: false,
        totalRecipients: 0,
        successCount: 0,
        failedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async runBirthdayBot(options: { dryRun?: boolean; testDate?: string } = {}): Promise<BirthdayBotResult> {
    const { dryRun = false, testDate } = options;
    
    console.log(`🎂 Running Birthday Bot (Configuration-Driven)${dryRun ? " [DRY RUN]" : ""}...`);
    
    const today = testDate ? new Date(testDate) : new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();
    console.log(`   Looking for birthdays: Month ${month}, Day ${day}, Year ${year}`);
    if (dryRun) {
      console.log("   ⚠️ DRY RUN MODE - No actual changes will be made");
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
        .select("id, name, passkit_program_id, birthday_bot_enabled, birthday_reward_points, birthday_message")
        .eq("birthday_bot_enabled", true);

      if (programError) {
        console.error("❌ Failed to query programs:", programError.message);
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
        console.log("⚠️ No programs have birthday bot enabled");
        return {
          success: true,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          alreadyGifted: 0,
          programsProcessed: 0,
        };
      }

      console.log(`📋 Found ${programs.length} programs with birthday bot enabled`);

      for (const program of programs as ProgramConfig[]) {
        console.log(`\n🏢 Processing program: ${program.name} (${program.passkit_program_id})`);
        console.log(`   Reward: ${program.birthday_reward_points} points`);
        console.log(`   Message: "${program.birthday_message}"`);

        // Query passes using program_id FK, not passkit_program_id
        // Also use status "INSTALLED" and is_active = true
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
          .not("users.birth_date", "is", null);

        if (passError) {
          console.error(`   ❌ Failed to query passes for ${program.name}:`, passError.message);
          continue;
        }

        if (!passes || passes.length === 0) {
          console.log(`   ⚠️ No passes with birth dates found for ${program.name}`);
          continue;
        }

        const eligiblePasses = passes.filter((pass: any) => {
          const user = pass.users;
          if (!user?.birth_date) return false;
          const birthDate = new Date(user.birth_date);
          return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
        }).map((pass: any) => ({
          ...pass,
          birth_date: pass.users.birth_date,
          user_id: pass.users.id,
        }));

        if (eligiblePasses.length === 0) {
          console.log(`   🎈 No birthdays today for ${program.name}`);
          continue;
        }

        console.log(`   🎉 Found ${eligiblePasses.length} birthdays today!`);
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
              console.log(`   🔍 [DRY RUN] Would gift ${pass.first_name} ${pass.last_name} (${pass.email}) - ${program.birthday_reward_points} points`);
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
              console.error(`   ❌ Failed to log birthday for ${pass.email}:`, logError.message);
              detail.reason = `Log error: ${logError.message}`;
              details.push(detail);
              totalFailed++;
              continue;
            }

            if (!logResult) {
              console.log(`   ⏭️ Skipping ${pass.first_name} ${pass.last_name} - already gifted this year`);
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
              console.error(`   ❌ Failed to award points to ${pass.email}:`, rpcError.message);
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

            console.log(`   🎁 Awarded ${program.birthday_reward_points} points to ${pass.first_name} ${pass.last_name}`);
            detail.status = "success";
            detail.reason = "Points awarded and notification sent";
            details.push(detail);
            totalSuccess++;

          } catch (error) {
            console.error(`   ❌ Error processing ${pass.email}:`, error);
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
          console.error("⚠️ Failed to log birthday campaign:", logError.message);
        }
        campaignLogId = logData?.id;
      }

      console.log(`\n✅ Birthday Bot complete${dryRun ? " [DRY RUN]" : ""}:`);
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
      console.error("❌ Birthday Bot error:", error);
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

  async getCampaignLogs(programId?: string, limit = 50): Promise<{ success: boolean; logs?: any[]; error?: string }> {
    try {
      const client = this.getClient();

      let query = client
        .from("notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (programId) {
        query = query.eq("program_id", programId);
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
}

export const notificationService = new NotificationService();
