import axios from "axios";
import { generatePassKitToken } from "../utils/passkitJWT";
import { supabaseService } from "./supabase.service";

const PASSKIT_BASE_URL = "https://api.pub2.passkit.io";

interface PassKitMember {
  id: string;
  externalId?: string;
  programId: string;
  tierId?: string;
  tierName?: string;
  points?: number;
  person?: {
    emailAddress?: string;
    forename?: string;
    surname?: string;
    mobileNumber?: string;
  };
  created?: string;
  updated?: string;
  passUrl?: string;
}

interface ListMembersOptions {
  programId: string;
  limit?: number;
  offset?: number;
  cursor?: string;
}

interface ListMembersResult {
  success: boolean;
  members?: PassKitMember[];
  nextCursor?: string;
  total?: number;
  error?: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  failed: number;
  errors: string[];
  duration_ms: number;
}

interface ProgramSyncState {
  id: string;
  program_id: string;
  last_full_sync_at: string | null;
  last_delta_sync_at: string | null;
  last_sync_cursor: string | null;
  total_passes_synced: number;
  last_sync_status: string;
  last_sync_error: string | null;
  sync_enabled: boolean;
}

class PassKitSyncService {
  private getAuthHeaders(): { Authorization: string } | null {
    const token = generatePassKitToken();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }

  async listMembers(options: ListMembersOptions): Promise<ListMembersResult> {
    const authHeaders = this.getAuthHeaders();
    
    if (!authHeaders) {
      console.log("⚠️ No PassKit Keys found. Cannot list members.");
      return { 
        success: false, 
        error: "PassKit not configured" 
      };
    }

    console.log(`📋 Fetching PassKit members for program: ${options.programId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/member/list/${options.programId}`;
      
      const payload: Record<string, unknown> = {
        filters: {
          limit: options.limit || 100,
          offset: options.offset || 0,
          orderBy: "created",
          orderAsc: true,
        },
      };

      if (options.cursor) {
        (payload.filters as Record<string, unknown>).cursor = options.cursor;
      }

      const config = {
        headers: { 
          ...authHeaders,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      };

      console.log(`📤 PassKit POST ${url}`, JSON.stringify(payload, null, 2));
      const response = await axios.post(url, payload, config);

      let members: PassKitMember[] = [];
      let nextCursor: string | undefined;
      let total = 0;

      console.log(`[PassKit Sync] Response type: ${typeof response.data}`);

      if (typeof response.data === "string") {
        const lines = response.data.split("\n").filter((line: string) => line.trim());
        console.log(`[PassKit Sync] NDJSON lines: ${lines.length}`);
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed?.result && typeof parsed.result === "object") {
              members.push(this.normalizePassKitMember(parsed.result));
            } else if (parsed && typeof parsed === "object" && parsed.id) {
              members.push(this.normalizePassKitMember(parsed));
            } else if (parsed?.cursor) {
              nextCursor = parsed.cursor;
            }
          } catch (e) {
            console.warn(`[PassKit Sync] Failed to parse line: ${line.substring(0, 100)}`);
          }
        }
        total = members.length;
      } else if (Array.isArray(response.data)) {
        members = response.data.map((m: Record<string, unknown>) => this.normalizePassKitMember(m));
        total = members.length;
      } else if (response.data?.members || response.data?.Members) {
        const rawMembers = response.data.members || response.data.Members;
        members = rawMembers.map((m: Record<string, unknown>) => this.normalizePassKitMember(m));
        total = response.data.total || response.data.Total || members.length;
        nextCursor = response.data.cursor || response.data.nextCursor;
      } else if (response.data && typeof response.data === "object" && response.data.id) {
        members = [this.normalizePassKitMember(response.data)];
        total = 1;
      }

      console.log(`✅ Retrieved ${members.length} members from PassKit`);

      return {
        success: true,
        members,
        nextCursor,
        total,
      };

    } catch (error) {
      let errorMessage = "Failed to list PassKit members";
      
      if (axios.isAxiosError(error)) {
        console.error("❌ PassKit List Members Error:", {
          status: error.response?.status,
          data: error.response?.data,
        });
        errorMessage = `PassKit API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  private normalizePassKitMember(raw: Record<string, unknown>): PassKitMember {
    return {
      id: (raw.id as string) || "",
      externalId: raw.externalId as string | undefined,
      programId: (raw.programId as string) || "",
      tierId: raw.tierId as string | undefined,
      tierName: raw.tierName as string | undefined,
      points: raw.points as number | undefined,
      person: raw.person as PassKitMember["person"],
      created: raw.created as string | undefined,
      updated: raw.updated as string | undefined,
      passUrl: raw.passUrl as string | undefined,
    };
  }

  async getMember(programId: string, externalId: string): Promise<{
    success: boolean;
    member?: PassKitMember;
    error?: string;
  }> {
    const authHeaders = this.getAuthHeaders();
    
    if (!authHeaders) {
      return { 
        success: false, 
        error: "PassKit not configured" 
      };
    }

    try {
      const url = `${PASSKIT_BASE_URL}/members/member`;
      
      const config = {
        headers: { 
          ...authHeaders,
          "Content-Type": "application/json",
        },
        params: {
          programId,
          externalId,
        },
        timeout: 30000,
      };

      const response = await axios.get(url, config);

      return {
        success: true,
        member: this.normalizePassKitMember(response.data),
      };

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { success: true, member: undefined };
      }
      
      return {
        success: false,
        error: axios.isAxiosError(error) 
          ? `PassKit API Error: ${error.response?.status}` 
          : "Unknown error",
      };
    }
  }

  async syncProgramMembers(
    programId: string, 
    passkitProgramId: string,
    options: {
      fullSync?: boolean;
      maxPages?: number;
      pageSize?: number;
    } = {}
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const { fullSync = true, maxPages = 100, pageSize = 100 } = options;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔄 PASSKIT SYNC: Starting ${fullSync ? "FULL" : "DELTA"} sync`);
    console.log(`   Program ID (DB): ${programId}`);
    console.log(`   PassKit Program ID: ${passkitProgramId}`);
    console.log(`${"=".repeat(60)}\n`);

    const result: SyncResult = {
      success: false,
      synced: 0,
      created: 0,
      updated: 0,
      failed: 0,
      errors: [],
      duration_ms: 0,
    };

    await this.logSyncEvent(programId, fullSync ? "FULL_SYNC_START" : "DELTA_SYNC_START", "SCHEDULED");
    await this.updateSyncState(programId, fullSync ? "FULL" : "DELTA", "IN_PROGRESS");

    try {
      let cursor: string | undefined;
      let pagesProcessed = 0;
      let hasMore = true;

      while (hasMore && pagesProcessed < maxPages) {
        console.log(`📄 Fetching page ${pagesProcessed + 1}...`);
        
        const listResult = await this.listMembers({
          programId: passkitProgramId,
          limit: pageSize,
          cursor,
        });

        if (!listResult.success || !listResult.members) {
          result.errors.push(listResult.error || "Failed to fetch members");
          console.error(`❌ Failed to fetch page ${pagesProcessed + 1}:`, listResult.error);
          break;
        }

        console.log(`   Retrieved ${listResult.members.length} members`);

        for (const member of listResult.members) {
          try {
            const upsertResult = await this.upsertMemberToDatabase(programId, member);
            
            if (upsertResult.success) {
              result.synced++;
              if (upsertResult.action === "CREATED") {
                result.created++;
                await this.logSyncEvent(programId, "PASS_CREATED", "API", member.id, member.externalId);
              } else if (upsertResult.action === "UPDATED") {
                result.updated++;
                await this.logSyncEvent(programId, "PASS_UPDATED", "API", member.id, member.externalId);
              }
            } else {
              result.failed++;
              result.errors.push(`Member ${member.id}: ${upsertResult.error}`);
            }
          } catch (err) {
            result.failed++;
            result.errors.push(`Member ${member.id}: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }

        cursor = listResult.nextCursor;
        hasMore = listResult.members.length === pageSize && !!cursor;
        pagesProcessed++;

        console.log(`   Progress: ${result.synced} synced, ${result.failed} failed`);
      }

      result.success = result.failed === 0 || result.synced > 0;
      result.duration_ms = Date.now() - startTime;

      const finalStatus = result.failed === 0 ? "SUCCESS" : (result.synced > 0 ? "PARTIAL" : "FAILED");
      await this.updateSyncState(programId, fullSync ? "FULL" : "DELTA", finalStatus, cursor, result.synced);
      await this.logSyncEvent(
        programId, 
        fullSync ? "FULL_SYNC_COMPLETE" : "DELTA_SYNC_COMPLETE", 
        "SCHEDULED",
        undefined,
        undefined,
        { synced: result.synced, created: result.created, updated: result.updated, failed: result.failed }
      );

      console.log(`\n${"=".repeat(60)}`);
      console.log(`✅ SYNC COMPLETE`);
      console.log(`   Duration: ${result.duration_ms}ms`);
      console.log(`   Total synced: ${result.synced} (${result.created} created, ${result.updated} updated)`);
      console.log(`   Failed: ${result.failed}`);
      console.log(`${"=".repeat(60)}\n`);

      return result;

    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
      result.duration_ms = Date.now() - startTime;

      await this.updateSyncState(
        programId, 
        fullSync ? "FULL" : "DELTA", 
        "FAILED", 
        undefined, 
        0,
        error instanceof Error ? error.message : "Unknown error"
      );
      await this.logSyncEvent(
        programId, 
        fullSync ? "FULL_SYNC_FAILED" : "DELTA_SYNC_FAILED", 
        "SCHEDULED",
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : "Unknown error" }
      );

      console.error(`❌ SYNC FAILED:`, error);
      return result;
    }
  }

  private async upsertMemberToDatabase(
    programId: string,
    member: PassKitMember
  ): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
      const client = supabaseService.getClient();
      if (!client) {
        return { success: false, error: "Supabase not configured" };
      }

      // Try RPC first (requires migration 027)
      const { data, error } = await client.rpc("upsert_membership_pass_from_passkit", {
        p_program_id: programId,
        p_passkit_internal_id: member.id,
        p_external_id: member.externalId || member.id,
        p_status: "INSTALLED",
        p_member_email: member.person?.emailAddress || null,
        p_member_first_name: member.person?.forename || null,
        p_member_last_name: member.person?.surname || null,
        p_member_phone: member.person?.mobileNumber || null,
        p_passkit_tier_name: member.tierName || null,
        p_passkit_created_at: member.created || null,
        p_passkit_updated_at: member.updated || null,
      });

      if (error) {
        // If RPC doesn't exist (migration 027 not applied), use direct upsert fallback
        if (error.message.includes("function") || error.code === "PGRST202" || error.message.includes("upsert_membership_pass_from_passkit")) {
          console.log(`[Upsert] RPC not available, using direct insert fallback for ${member.id}`);
          return await this.directUpsertMember(programId, member);
        }
        console.error(`[Upsert] RPC error for member ${member.id}:`, error);
        return { success: false, error: error.message };
      }

      const result = data as { success: boolean; action?: string; error?: string };
      return result;

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  private async directUpsertMember(
    programId: string,
    member: PassKitMember
  ): Promise<{ success: boolean; action?: string; error?: string }> {
    try {
      const client = supabaseService.getClient();
      if (!client) {
        return { success: false, error: "Supabase not configured" };
      }

      // Check if pass already exists by passkit_internal_id
      const { data: existing } = await client
        .from("passes_master")
        .select("id")
        .eq("program_id", programId)
        .eq("passkit_internal_id", member.id)
        .single();

      if (existing) {
        // Update existing pass
        const { error: updateError } = await client
          .from("passes_master")
          .update({
            external_id: member.externalId || member.id,
            status: "INSTALLED",
            member_email: member.person?.emailAddress || null,
            member_first_name: member.person?.forename || null,
            member_last_name: member.person?.surname || null,
            last_updated: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) {
          return { success: false, error: updateError.message };
        }
        return { success: true, action: "UPDATED" };
      } else {
        // Insert new pass
        const { error: insertError } = await client
          .from("passes_master")
          .insert({
            program_id: programId,
            passkit_internal_id: member.id,
            external_id: member.externalId || member.id,
            status: "INSTALLED",
            is_active: true,
            protocol: "MEMBERSHIP",
            points_balance: 0,
            spend_tier_level: 1,
            member_email: member.person?.emailAddress || null,
            member_first_name: member.person?.forename || null,
            member_last_name: member.person?.surname || null,
            enrollment_source: "PASSKIT_SYNC",
            last_updated: new Date().toISOString(),
          });

        if (insertError) {
          // Handle duplicate key (race condition)
          if (insertError.code === "23505") {
            return { success: true, action: "UPDATED" };
          }
          return { success: false, error: insertError.message };
        }
        return { success: true, action: "CREATED" };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      };
    }
  }

  async getSyncState(programId: string): Promise<ProgramSyncState | null> {
    try {
      const client = supabaseService.getClient();
      if (!client) return null;

      const { data, error } = await client
        .from("passkit_sync_state")
        .select("*")
        .eq("program_id", programId)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("[Sync State] Error fetching:", error);
        return null;
      }

      return data as ProgramSyncState | null;

    } catch (error) {
      console.error("[Sync State] Exception:", error);
      return null;
    }
  }

  private async updateSyncState(
    programId: string,
    syncType: "FULL" | "DELTA",
    status: string,
    cursor?: string,
    passesSynced?: number,
    errorMsg?: string
  ): Promise<void> {
    try {
      const client = supabaseService.getClient();
      if (!client) return;

      const { data: existing, error: selectError } = await client
        .from("passkit_sync_state")
        .select("id")
        .eq("program_id", programId)
        .single();

      // If table doesn't exist (migration 027 not applied), silently skip
      if (selectError && (selectError.code === "42P01" || selectError.message.includes("relation") || selectError.message.includes("does not exist"))) {
        console.log("[Update Sync State] Table not available, skipping state update");
        return;
      }

      const updateData: Record<string, unknown> = {
        program_id: programId,
        last_sync_status: status,
        updated_at: new Date().toISOString(),
      };

      if (syncType === "FULL" && (status === "SUCCESS" || status === "PARTIAL")) {
        updateData.last_full_sync_at = new Date().toISOString();
      } else if (syncType === "DELTA" && (status === "SUCCESS" || status === "PARTIAL")) {
        updateData.last_delta_sync_at = new Date().toISOString();
      }

      if (cursor) {
        updateData.last_sync_cursor = cursor;
      }

      if (passesSynced !== undefined && existing) {
        const { data: current } = await client
          .from("passkit_sync_state")
          .select("total_passes_synced")
          .eq("program_id", programId)
          .single();
        
        updateData.total_passes_synced = (current?.total_passes_synced || 0) + passesSynced;
      } else if (passesSynced !== undefined) {
        updateData.total_passes_synced = passesSynced;
      }

      if (errorMsg) {
        updateData.last_sync_error = errorMsg;
      }

      if (existing) {
        await client
          .from("passkit_sync_state")
          .update(updateData)
          .eq("program_id", programId);
      } else {
        updateData.created_at = new Date().toISOString();
        await client
          .from("passkit_sync_state")
          .insert(updateData);
      }

    } catch (error) {
      // Silently fail - state tracking is not critical to sync success
      console.log("[Update Sync State] Skipped:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  private async logSyncEvent(
    programId: string,
    eventType: string,
    syncSource: string,
    passkitInternalId?: string,
    externalId?: string,
    payload?: Record<string, unknown>
  ): Promise<void> {
    try {
      const client = supabaseService.getClient();
      if (!client) return;

      const { error } = await client.from("passkit_event_journal").insert({
        program_id: programId,
        event_type: eventType,
        sync_source: syncSource,
        passkit_internal_id: passkitInternalId || null,
        external_id: externalId || null,
        event_payload: payload || null,
        created_at: new Date().toISOString(),
      });

      // Silently ignore if table doesn't exist (migration 027 not applied)
      if (error && (error.code === "42P01" || error.message.includes("relation") || error.message.includes("does not exist"))) {
        console.log("[Log Sync Event] Table not available, skipping log");
        return;
      }

    } catch (error) {
      // Silently fail - logging is not critical to sync success
      console.log("[Log Sync Event] Skipped:", error instanceof Error ? error.message : "Unknown error");
    }
  }

  async syncSinglePass(
    programId: string,
    passkitProgramId: string,
    passkitInternalId: string
  ): Promise<{ success: boolean; action?: string; error?: string }> {
    console.log(`🔄 Syncing single pass: ${passkitInternalId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/member/${passkitInternalId}`;
      const authHeaders = this.getAuthHeaders();
      
      if (!authHeaders) {
        return { success: false, error: "PassKit not configured" };
      }

      const response = await axios.get(url, {
        headers: { ...authHeaders, "Content-Type": "application/json" },
        timeout: 30000,
      });

      const member = this.normalizePassKitMember(response.data);
      const result = await this.upsertMemberToDatabase(programId, member);

      if (result.success) {
        await this.logSyncEvent(
          programId,
          result.action === "CREATED" ? "PASS_CREATED" : "PASS_UPDATED",
          "WEBHOOK",
          passkitInternalId,
          member.externalId
        );
      }

      return result;

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { success: false, error: "Member not found in PassKit" };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  isConfigured(): boolean {
    return !!this.getAuthHeaders();
  }

  async syncSinglePassFromWebhook(
    programId: string,
    passkitProgramId: string,
    webhookData: {
      id: string;
      externalId?: string;
      programId?: string;
      tierId?: string;
      tierName?: string;
      points?: number;
      person?: {
        emailAddress?: string;
        forename?: string;
        surname?: string;
        mobileNumber?: string;
      };
    }
  ): Promise<{ success: boolean; action?: string; error?: string }> {
    console.log(`🔄 Syncing pass from webhook: ${webhookData.id}`);

    try {
      const member: PassKitMember = {
        id: webhookData.id,
        externalId: webhookData.externalId || webhookData.id,
        programId: passkitProgramId,
        tierId: webhookData.tierId,
        tierName: webhookData.tierName,
        points: webhookData.points,
        person: webhookData.person,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      const result = await this.upsertMemberToDatabase(programId, member);

      if (result.success) {
        await this.logSyncEvent(
          programId,
          result.action === "CREATED" ? "PASS_CREATED" : "PASS_UPDATED",
          "WEBHOOK",
          webhookData.id,
          member.externalId,
          { source: "webhook", email: webhookData.person?.emailAddress }
        );
      }

      return result;

    } catch (error) {
      console.error(`[Webhook Sync] Error syncing pass ${webhookData.id}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const passKitSyncService = new PassKitSyncService();
