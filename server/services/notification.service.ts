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

interface BroadcastResult {
  success: boolean;
  totalRecipients: number;
  successCount: number;
  failedCount: number;
  campaignLogId?: string;
  error?: string;
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

  async sendBroadcast(
    programId: string,
    message: string,
    segment?: "ALL" | "VIP",
    campaignName?: string
  ): Promise<BroadcastResult> {
    console.log(`📢 Starting broadcast for program: ${programId}`);
    console.log(`   Message: "${message}"`);
    console.log(`   Segment: ${segment || "ALL"}`);

    try {
      const client = this.getClient();

      let query = client
        .from("passes_master")
        .select("id, passkit_internal_id, passkit_program_id, tier_points, email, first_name, last_name")
        .eq("passkit_program_id", programId)
        .eq("status", "ACTIVE");

      if (segment === "VIP") {
        query = query.gt("tier_points", 1000);
        console.log("   Filtering for VIP members (tier_points > 1000)");
      }

      const { data: passes, error: queryError } = await query;

      if (queryError) {
        console.error("❌ Failed to query passes:", queryError.message);
        return {
          success: false,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
          error: queryError.message,
        };
      }

      if (!passes || passes.length === 0) {
        console.log("⚠️ No active passes found for this program/segment");
        return {
          success: true,
          totalRecipients: 0,
          successCount: 0,
          failedCount: 0,
        };
      }

      console.log(`📬 Found ${passes.length} recipients`);

      const { successCount, failedCount } = await this.processBatch(
        passes as PassRecord[],
        async (pass) => {
          const result = await passKitService.pushMessage(
            pass.passkit_internal_id,
            pass.passkit_program_id,
            message
          );
          if (!result.success) {
            throw new Error(result.error);
          }
          return result;
        }
      );

      const { data: logData, error: logError } = await client
        .from("notification_logs")
        .insert({
          program_id: programId,
          campaign_name: campaignName || "Broadcast",
          recipient_count: passes.length,
          success_count: successCount,
          failed_count: failedCount,
          message_content: message,
          target_segment: segment || "ALL",
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

        const { data: passes, error: passError } = await client
          .from("passes_master")
          .select(`
            id,
            passkit_internal_id,
            passkit_program_id,
            email,
            first_name,
            last_name,
            user_id,
            users!inner (
              id,
              birth_date
            )
          `)
          .eq("passkit_program_id", program.passkit_program_id)
          .eq("status", "ACTIVE")
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
