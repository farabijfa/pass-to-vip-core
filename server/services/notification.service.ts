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
  campaignLogId?: string;
  error?: string;
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

  async runBirthdayBot(): Promise<BirthdayBotResult> {
    console.log("🎂 Running Birthday Bot...");
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    console.log(`   Looking for birthdays: Month ${month}, Day ${day}`);

    try {
      const client = this.getClient();

      const { data: birthdayUsers, error: queryError } = await client
        .from("users")
        .select(`
          id,
          email,
          first_name,
          last_name,
          birth_date
        `)
        .not("birth_date", "is", null)
        .eq("marketing_opt_in", true);

      if (queryError) {
        console.error("❌ Failed to query birthday users:", queryError.message);
        return {
          success: false,
          processed: 0,
          successCount: 0,
          failedCount: 0,
          error: queryError.message,
        };
      }

      const todaysBirthdays = (birthdayUsers || []).filter((user: any) => {
        if (!user.birth_date) return false;
        const birthDate = new Date(user.birth_date);
        return birthDate.getMonth() + 1 === month && birthDate.getDate() === day;
      });

      if (todaysBirthdays.length === 0) {
        console.log("🎈 No birthdays today");
        return {
          success: true,
          processed: 0,
          successCount: 0,
          failedCount: 0,
        };
      }

      console.log(`🎉 Found ${todaysBirthdays.length} birthdays today!`);

      const birthdayMessage = "Happy Birthday! 🎂 We added 50 points to your card.";
      const birthdayPoints = 50;

      const { successCount, failedCount } = await this.processBatch(
        todaysBirthdays,
        async (user: any) => {
          const { error: rpcError } = await client.rpc("process_membership_transaction", {
            p_member_id: user.id,
            p_transaction_type: "EARN",
            p_points: birthdayPoints,
            p_description: "Birthday Bonus",
            p_metadata: { source: "birthday_bot" },
          });

          if (rpcError) {
            console.error(`❌ Failed to award points to ${user.email}:`, rpcError.message);
            throw new Error(rpcError.message);
          }

          const { data: userPass } = await client
            .from("passes_master")
            .select("passkit_internal_id, passkit_program_id")
            .eq("email", user.email)
            .eq("status", "ACTIVE")
            .single();

          if (userPass?.passkit_internal_id && userPass?.passkit_program_id) {
            await passKitService.pushMessage(
              userPass.passkit_internal_id,
              userPass.passkit_program_id,
              birthdayMessage
            );
          }

          console.log(`🎁 Awarded ${birthdayPoints} points to ${user.first_name} ${user.last_name}`);
          return { userId: user.id, success: true };
        }
      );

      const { data: logData, error: logError } = await client
        .from("notification_logs")
        .insert({
          campaign_name: "Birthday Bot",
          recipient_count: todaysBirthdays.length,
          success_count: successCount,
          failed_count: failedCount,
          message_content: birthdayMessage,
          target_segment: "BIRTHDAY",
        })
        .select("id")
        .single();

      if (logError) {
        console.error("⚠️ Failed to log birthday campaign:", logError.message);
      }

      console.log(`✅ Birthday Bot complete: ${successCount} success, ${failedCount} failed`);

      return {
        success: true,
        processed: todaysBirthdays.length,
        successCount,
        failedCount,
        campaignLogId: logData?.id,
      };

    } catch (error) {
      console.error("❌ Birthday Bot error:", error);
      return {
        success: false,
        processed: 0,
        successCount: 0,
        failedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
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
