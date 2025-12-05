import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "../config";
import short from "short-uuid";
import { passKitProvisionService } from "./passkit-provision.service";

interface CreateTenantParams {
  businessName: string;
  email: string;
  password: string;
  passkitProgramId?: string;
  passkitTierId?: string;
  protocol: "MEMBERSHIP" | "COUPON" | "EVENT_TICKET";
  timezone?: string;
  autoProvision?: boolean;
  earnRateMultiplier?: number;
}

interface CreateTenantResult {
  success: boolean;
  userId?: string;
  programId?: string;
  email?: string;
  businessName?: string;
  dashboardSlug?: string;
  dashboardUrl?: string;
  passkitStatus?: "provisioned" | "manual_required" | "skipped" | "pending";
  passkitProgramId?: string;
  passkitTierId?: string;
  enrollmentUrl?: string;
  timezone?: string;
  earnRateMultiplier?: number;
  error?: string;
}

interface RetryPassKitResult {
  success: boolean;
  programId?: string;
  passkitStatus?: "provisioned" | "manual_required";
  passkitProgramId?: string;
  passkitTierId?: string;
  enrollmentUrl?: string;
  error?: string;
}

interface Program {
  id: string;
  name: string;
  passkit_program_id: string;
  protocol: string;
  dashboard_slug: string;
  created_at: string;
}

// Multi-Program Support Interfaces
interface AddProgramParams {
  tenantId: string;
  name: string;
  protocol: "MEMBERSHIP" | "COUPON" | "EVENT_TICKET";
  passkitProgramId?: string;
  passkitTierId?: string;
  timezone?: string;
  autoProvision?: boolean;
  earnRateMultiplier?: number;
}

interface AddProgramResult {
  success: boolean;
  programId?: string;
  passkitStatus?: "provisioned" | "manual_required" | "skipped";
  passkitProgramId?: string;
  passkitTierId?: string;
  enrollmentUrl?: string;
  dashboardSlug?: string;
  error?: string;
}

interface TenantProgram {
  id: string;
  name: string;
  protocol: string;
  passkitProgramId: string | null;
  passkitTierId: string | null;
  passkitStatus: string;
  enrollmentUrl: string | null;
  dashboardSlug: string | null;
  timezone: string;
  earnRateMultiplier: number;
  isSuspended: boolean;
  isPrimary: boolean;
  postgridTemplateId: string | null;
  memberLimit: number | null;
  campaignBudgetCents: number;
  tierBronzeMax: number;
  tierSilverMax: number;
  tierGoldMax: number;
  createdAt: string;
}

interface ListTenantProgramsResult {
  success: boolean;
  programs?: TenantProgram[];
  error?: string;
}

class AdminService {
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!this.client) {
      if (!isSupabaseConfigured()) {
        throw new Error("Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.");
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

  async createTenant(params: CreateTenantParams): Promise<CreateTenantResult> {
    const { 
      businessName, 
      email, 
      password, 
      passkitProgramId: providedProgramId, 
      passkitTierId: providedTierId,
      protocol,
      timezone = "America/New_York",
      autoProvision = true,
      earnRateMultiplier = 10,
    } = params;

    console.log(`🏢 Creating new tenant: ${businessName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Protocol: ${protocol}`);
    console.log(`   Auto-Provision: ${autoProvision}`);
    console.log(`   Earn Rate Multiplier: ${earnRateMultiplier}x`);
    if (providedProgramId) {
      console.log(`   Provided PassKit Program: ${providedProgramId}`);
    }

    let passkitData = {
      programId: providedProgramId || null as string | null,
      tierId: providedTierId || null as string | null,
      enrollmentUrl: null as string | null,
      status: "skipped" as "provisioned" | "manual_required" | "skipped",
    };

    try {
      const client = this.getClient();

      if (autoProvision && !providedProgramId && protocol === "MEMBERSHIP") {
        console.log("🚀 Attempting auto-provision of PassKit program...");
        try {
          const pkResult = await passKitProvisionService.createMembershipProgram({
            clientName: businessName,
            timezone,
          });
          
          if (pkResult.success && pkResult.programId) {
            passkitData.programId = pkResult.programId;
            passkitData.tierId = pkResult.tierId || null;
            passkitData.enrollmentUrl = pkResult.enrollmentUrl || null;
            passkitData.status = "provisioned";
            console.log(`✅ PassKit auto-provisioned: ${pkResult.programId}`);
          } else {
            console.warn("⚠️ PassKit provisioning failed (soft-fail):", pkResult.error);
            passkitData.status = "manual_required";
          }
        } catch (pkError) {
          console.warn("⚠️ PassKit provisioning exception (soft-fail):", pkError);
          passkitData.status = "manual_required";
        }
      } else if (providedProgramId) {
        passkitData.status = "provisioned";
        console.log(`   Using provided PassKit Program: ${providedProgramId}`);
      }

      console.log("🔍 Step 0: Checking for duplicates...");
      let duplicateQuery = `name.eq.${businessName}`;
      if (passkitData.programId) {
        duplicateQuery += `,passkit_program_id.eq.${passkitData.programId}`;
      }
      
      const { data: existingPrograms, error: duplicateError } = await client
        .from("programs")
        .select("id, name, passkit_program_id")
        .or(duplicateQuery);

      if (duplicateError) {
        console.error("❌ Duplicate check failed:", duplicateError.message);
        return {
          success: false,
          error: `Duplicate check error: ${duplicateError.message}`,
        };
      }

      if (existingPrograms && existingPrograms.length > 0) {
        const duplicate = existingPrograms[0];
        if (duplicate.name === businessName) {
          console.error(`❌ Business name "${businessName}" already exists`);
          return {
            success: false,
            error: `A program with the name "${businessName}" already exists`,
          };
        }
        if (passkitData.programId && duplicate.passkit_program_id === passkitData.programId) {
          console.error(`❌ PassKit Program ID "${passkitData.programId}" already exists`);
          return {
            success: false,
            error: `A program with PassKit ID "${passkitData.programId}" already exists`,
          };
        }
      }
      console.log("✅ No duplicates found");

      // Step 1: Create Auth User
      console.log("📧 Step 1: Creating auth user...");
      const { data: authData, error: authError } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          business_name: businessName,
          role: "CLIENT_ADMIN",
        },
      });

      if (authError) {
        console.error("❌ Auth user creation failed:", authError.message);
        return {
          success: false,
          error: `Auth error: ${authError.message}`,
        };
      }

      if (!authData.user) {
        return {
          success: false,
          error: "Failed to create user - no user returned",
        };
      }

      const userId = authData.user.id;
      console.log(`✅ Auth user created: ${userId}`);

      // Step 2: Create Program with unique dashboard slug
      console.log("🎫 Step 2: Creating program...");
      const dashboardSlug = short.generate();
      
      // Check if dashboard_slug column exists (feature detection)
      const hasDashboardSlug = await this.checkDashboardSlugColumn();
      
      const programInsert: Record<string, any> = {
        name: businessName,
        passkit_program_id: passkitData.programId,
        passkit_tier_id: passkitData.tierId,
        enrollment_url: passkitData.enrollmentUrl,
        passkit_status: passkitData.status,
        timezone: timezone,
        protocol: protocol,
        earn_rate_multiplier: earnRateMultiplier,
        tenant_id: userId,
        is_primary: true,
      };
      
      if (hasDashboardSlug) {
        programInsert.dashboard_slug = dashboardSlug;
        console.log(`   Dashboard slug: ${dashboardSlug}`);
      }
      
      console.log(`   PassKit Program ID: ${passkitData.programId || "PENDING"}`);
      console.log(`   PassKit Tier ID: ${passkitData.tierId || "PENDING"}`);
      console.log(`   Enrollment URL: ${passkitData.enrollmentUrl || "PENDING"}`);
      console.log(`   PassKit Status: ${passkitData.status}`);
      console.log(`   Timezone: ${timezone}`);
      
      const { data: programData, error: programError } = await client
        .from("programs")
        .insert(programInsert)
        .select()
        .single();

      if (programError) {
        console.error("❌ Program creation failed:", programError.message);
        // Rollback: Delete the auth user
        await this.rollbackAuthUser(userId);
        return {
          success: false,
          error: `Program error: ${programError.message}`,
        };
      }

      const programId = (programData as Program).id;
      console.log(`✅ Program created: ${programId}`);

      // Step 3: Create Admin Profile (Link User to Program)
      console.log("🔗 Step 3: Linking user to program...");
      const { error: profileError } = await client
        .from("admin_profiles")
        .insert({
          id: userId,
          program_id: programId,
          role: "CLIENT_ADMIN",
        });

      if (profileError) {
        console.error("❌ Admin profile creation failed:", profileError.message);
        // Rollback: Delete program and auth user
        await this.rollbackProgram(programId);
        await this.rollbackAuthUser(userId);
        return {
          success: false,
          error: `Profile error: ${profileError.message}`,
        };
      }

      console.log("✅ Admin profile created - User linked to program");

      console.log("🎉 Tenant provisioning complete!");
      console.log(`   User ID: ${userId}`);
      console.log(`   Program ID: ${programId}`);
      console.log(`   Business: ${businessName}`);
      console.log(`   PassKit Status: ${passkitData.status}`);

      const result: CreateTenantResult = {
        success: true,
        userId,
        programId,
        email,
        businessName,
        passkitStatus: passkitData.status,
        passkitProgramId: passkitData.programId || undefined,
        passkitTierId: passkitData.tierId || undefined,
        enrollmentUrl: passkitData.enrollmentUrl || undefined,
        timezone,
        earnRateMultiplier,
      };

      if (hasDashboardSlug) {
        result.dashboardSlug = dashboardSlug;
        result.dashboardUrl = `/enroll/${dashboardSlug}`;
        console.log(`   Dashboard URL: /enroll/${dashboardSlug}`);
      }

      return result;

    } catch (error) {
      console.error("❌ Tenant creation error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  private async checkDashboardSlugColumn(): Promise<boolean> {
    try {
      const client = this.getClient();
      // Try to select the column - if it doesn't exist, this will fail
      const { error } = await client
        .from("programs")
        .select("dashboard_slug")
        .limit(1);
      
      if (error && error.message.includes("dashboard_slug")) {
        console.log("ℹ️ dashboard_slug column not available - run migration 010");
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  private async rollbackAuthUser(userId: string): Promise<void> {
    try {
      console.log(`🔄 Rolling back: Deleting auth user ${userId}`);
      const client = this.getClient();
      await client.auth.admin.deleteUser(userId);
      console.log("✅ Auth user rolled back");
    } catch (error) {
      console.error("⚠️ Failed to rollback auth user:", error);
    }
  }

  private async rollbackProgram(programId: string): Promise<void> {
    try {
      console.log(`🔄 Rolling back: Deleting program ${programId}`);
      const client = this.getClient();
      await client.from("programs").delete().eq("id", programId);
      console.log("✅ Program rolled back");
    } catch (error) {
      console.error("⚠️ Failed to rollback program:", error);
    }
  }

  async getTenant(userId: string): Promise<{ success: boolean; tenant?: any; error?: string }> {
    try {
      const client = this.getClient();

      const { data: profile, error: profileError } = await client
        .from("admin_profiles")
        .select(`
          id,
          role,
          created_at,
          programs:program_id (
            id,
            name,
            passkit_program_id,
            protocol
          )
        `)
        .eq("id", userId)
        .single();

      if (profileError) {
        return { success: false, error: profileError.message };
      }

      return { success: true, tenant: profile };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listTenants(): Promise<{ success: boolean; tenants?: any[]; error?: string }> {
    try {
      const client = this.getClient();

      const { data: profiles, error } = await client
        .from("admin_profiles")
        .select(`
          id,
          role,
          created_at,
          programs:program_id (
            id,
            name,
            passkit_program_id,
            passkit_tier_id,
            passkit_status,
            protocol,
            timezone,
            is_suspended,
            dashboard_slug,
            enrollment_url,
            earn_rate_multiplier
          )
        `)
        .order("created_at", { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, tenants: profiles || [] };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async deleteTenant(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();

      // Get the program ID first
      const { data: profile } = await client
        .from("admin_profiles")
        .select("program_id")
        .eq("id", userId)
        .single();

      if (profile?.program_id) {
        // Delete program (cascades to admin_profiles via FK)
        await client.from("programs").delete().eq("id", profile.program_id);
      }

      // Delete auth user
      await client.auth.admin.deleteUser(userId);

      console.log(`🗑️ Tenant deleted: ${userId}`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async retryPassKitProvisioning(programId: string): Promise<RetryPassKitResult> {
    console.log(`🔄 Retrying PassKit provisioning for program: ${programId}`);
    
    try {
      const client = this.getClient();

      // Get the program details
      const { data: program, error: fetchError } = await client
        .from("programs")
        .select("id, name, passkit_status, passkit_program_id, protocol, timezone")
        .eq("id", programId)
        .single();

      if (fetchError || !program) {
        return {
          success: false,
          error: fetchError?.message || "Program not found",
        };
      }

      // Check if retry is applicable
      if (program.passkit_program_id) {
        return {
          success: false,
          error: "Program already has a PassKit ID configured. Use update endpoint instead.",
        };
      }

      // Only allow retry for manual_required or skipped status
      if (!["manual_required", "skipped"].includes(program.passkit_status || "skipped")) {
        return {
          success: false,
          error: `Cannot retry provisioning for status: ${program.passkit_status}. Only manual_required or skipped programs can be retried.`,
        };
      }

      if (program.protocol !== "MEMBERSHIP") {
        return {
          success: false,
          error: `Auto-provisioning only supports MEMBERSHIP protocol. This program uses ${program.protocol}.`,
        };
      }

      // Set status to pending before attempt
      await client
        .from("programs")
        .update({ passkit_status: "pending" })
        .eq("id", programId);

      // Attempt PassKit provisioning
      console.log(`🚀 Attempting PassKit provisioning for "${program.name}"...`);
      const pkResult = await passKitProvisionService.createMembershipProgram({
        clientName: program.name,
        timezone: program.timezone || "America/New_York",
      });

      if (!pkResult.success || !pkResult.programId) {
        // Update status back to manual_required
        await client
          .from("programs")
          .update({ passkit_status: "manual_required" })
          .eq("id", programId);

        return {
          success: false,
          programId,
          passkitStatus: "manual_required",
          error: pkResult.error || "PassKit provisioning failed",
        };
      }

      // Update program with PassKit details
      const { error: updateError } = await client
        .from("programs")
        .update({
          passkit_program_id: pkResult.programId,
          passkit_tier_id: pkResult.tierId,
          enrollment_url: pkResult.enrollmentUrl,
          passkit_status: "provisioned",
        })
        .eq("id", programId);

      if (updateError) {
        console.error("❌ Failed to update program with PassKit details:", updateError.message);
        
        // Revert status from pending back to manual_required so dashboard shows correct state
        await client
          .from("programs")
          .update({ passkit_status: "manual_required" })
          .eq("id", programId);
        
        return {
          success: false,
          programId,
          passkitStatus: "manual_required",
          error: `PassKit provisioned (programId: ${pkResult.programId}, tierId: ${pkResult.tierId}) but failed to save to database: ${updateError.message}. Manual configuration required.`,
        };
      }

      console.log(`✅ PassKit provisioning successful for program ${programId}`);
      return {
        success: true,
        programId,
        passkitStatus: "provisioned",
        passkitProgramId: pkResult.programId,
        passkitTierId: pkResult.tierId,
        enrollmentUrl: pkResult.enrollmentUrl,
      };

    } catch (error) {
      console.error("❌ Retry provisioning error:", error);
      
      // Attempt to rollback status from pending to manual_required if we set it
      try {
        const client = this.getClient();
        await client
          .from("programs")
          .update({ passkit_status: "manual_required" })
          .eq("id", programId);
      } catch (rollbackError) {
        console.error("❌ Failed to rollback pending status:", rollbackError);
      }
      
      return {
        success: false,
        programId,
        passkitStatus: "manual_required",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async updatePassKitSettings(
    programId: string, 
    settings: { passkitProgramId?: string; passkitTierId?: string; enrollmentUrl?: string }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();

      // Check if program exists
      const { data: existingProgram, error: fetchError } = await client
        .from("programs")
        .select("id, name")
        .eq("id", programId)
        .single();

      if (fetchError || !existingProgram) {
        return { success: false, error: "Program not found" };
      }

      // Check for duplicate PassKit program ID if one is being set
      if (settings.passkitProgramId) {
        const { data: duplicates, error: dupError } = await client
          .from("programs")
          .select("id, name")
          .eq("passkit_program_id", settings.passkitProgramId)
          .neq("id", programId);

        if (dupError) {
          return { success: false, error: `Duplicate check failed: ${dupError.message}` };
        }

        if (duplicates && duplicates.length > 0) {
          return { 
            success: false, 
            error: `PassKit Program ID "${settings.passkitProgramId}" is already used by program "${duplicates[0].name}"` 
          };
        }
      }

      const updates: Record<string, any> = {};
      
      if (settings.passkitProgramId !== undefined) {
        updates.passkit_program_id = settings.passkitProgramId;
        // Mark as provisioned when a PassKit program ID is set
        updates.passkit_status = "provisioned";
      }
      if (settings.passkitTierId !== undefined) {
        updates.passkit_tier_id = settings.passkitTierId;
      }
      if (settings.enrollmentUrl !== undefined) {
        updates.enrollment_url = settings.enrollmentUrl;
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: "No valid fields to update" };
      }

      const { error } = await client
        .from("programs")
        .update(updates)
        .eq("id", programId);

      if (error) {
        return { success: false, error: error.message };
      }

      console.log(`✅ PassKit settings updated for program ${programId}`);
      return { success: true };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getPassKitHealth(): Promise<{ 
    configured: boolean; 
    status: "connected" | "error" | "not_configured";
    error?: string;
  }> {
    const isConfigured = passKitProvisionService.isConfigured();
    
    if (!isConfigured) {
      return {
        configured: false,
        status: "not_configured",
      };
    }

    // TODO: Add actual PassKit API health check call
    return {
      configured: true,
      status: "connected",
    };
  }

  async getTenantFullProfile(userId: string): Promise<{
    success: boolean;
    profile?: {
      user: {
        id: string;
        email: string;
        name: string;
        createdAt: string;
      };
      program: {
        id: string;
        name: string;
        protocol: string;
        dashboardSlug: string;
        enrollmentUrl: string | null;
        isSuspended: boolean;
        timezone: string;
        earnRateMultiplier: number;
        memberLimit: number | null;
        postgridTemplateId: string | null;
        passkit: {
          status: string;
          programId: string | null;
          tierId: string | null;
        };
      };
      billing: {
        activeMembers: number;
        churnedMembers: number;
        memberLimit: number | null;
        usagePercent: number;
        isOverLimit: boolean;
        lastSnapshotAt: string | null;
      };
      apiKeys: Array<{
        id: string;
        keyPrefix: string;
        createdAt: string;
        lastUsedAt: string | null;
        isActive: boolean;
      }>;
    };
    error?: string;
  }> {
    console.log(`📊 Fetching full profile for user: ${userId}`);
    
    try {
      const client = this.getClient();

      // Get user details from auth
      const { data: userData, error: userError } = await client.auth.admin.getUserById(userId);
      
      if (userError || !userData.user) {
        return { success: false, error: userError?.message || "User not found" };
      }

      // Get admin profile with program details
      const { data: profile, error: profileError } = await client
        .from("admin_profiles")
        .select(`
          id,
          role,
          created_at,
          programs:program_id (
            id,
            name,
            passkit_program_id,
            passkit_tier_id,
            passkit_status,
            protocol,
            timezone,
            is_suspended,
            dashboard_slug,
            enrollment_url,
            earn_rate_multiplier,
            member_limit,
            postgrid_template_id
          )
        `)
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        return { success: false, error: profileError?.message || "Profile not found" };
      }

      const program = profile.programs as any;
      if (!program) {
        return { success: false, error: "No program associated with this user" };
      }

      // Get billing snapshot for this program
      let billingData = {
        activeMembers: 0,
        churnedMembers: 0,
        lastSnapshotAt: null as string | null,
      };

      const { data: snapshot } = await client
        .from("billing_snapshots")
        .select("active_members, churned_members, created_at")
        .eq("program_id", program.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (snapshot) {
        billingData.activeMembers = snapshot.active_members || 0;
        billingData.churnedMembers = snapshot.churned_members || 0;
        billingData.lastSnapshotAt = snapshot.created_at;
      } else {
        // If no snapshot, count members directly
        const { count: activeCount } = await client
          .from("passes_master")
          .select("*", { count: "exact", head: true })
          .eq("program_id", program.id)
          .neq("status", "CHURNED");

        const { count: churnedCount } = await client
          .from("passes_master")
          .select("*", { count: "exact", head: true })
          .eq("program_id", program.id)
          .eq("status", "CHURNED");

        billingData.activeMembers = activeCount || 0;
        billingData.churnedMembers = churnedCount || 0;
      }

      // Get POS API keys
      const { data: apiKeys } = await client
        .from("pos_api_keys")
        .select("id, key_prefix, created_at, last_used_at, is_active")
        .eq("program_id", program.id)
        .order("created_at", { ascending: false });

      const memberLimit = program.member_limit || null;
      const usagePercent = memberLimit ? Math.round((billingData.activeMembers / memberLimit) * 100) : 0;

      console.log(`✅ Full profile loaded for ${userData.user.email}`);

      return {
        success: true,
        profile: {
          user: {
            id: userData.user.id,
            email: userData.user.email || "",
            name: userData.user.user_metadata?.business_name || program.name || "",
            createdAt: userData.user.created_at || "",
          },
          program: {
            id: program.id,
            name: program.name,
            protocol: program.protocol || "MEMBERSHIP",
            dashboardSlug: program.dashboard_slug || "",
            enrollmentUrl: program.enrollment_url || null,
            isSuspended: program.is_suspended || false,
            timezone: program.timezone || "America/New_York",
            earnRateMultiplier: program.earn_rate_multiplier || 10,
            memberLimit: program.member_limit || null,
            postgridTemplateId: program.postgrid_template_id || null,
            passkit: {
              status: program.passkit_status || "manual_required",
              programId: program.passkit_program_id || null,
              tierId: program.passkit_tier_id || null,
            },
          },
          billing: {
            activeMembers: billingData.activeMembers,
            churnedMembers: billingData.churnedMembers,
            memberLimit,
            usagePercent,
            isOverLimit: memberLimit ? billingData.activeMembers > memberLimit : false,
            lastSnapshotAt: billingData.lastSnapshotAt,
          },
          apiKeys: (apiKeys || []).map((key: any) => ({
            id: key.id,
            keyPrefix: key.key_prefix || key.id.slice(0, 8),
            createdAt: key.created_at,
            lastUsedAt: key.last_used_at,
            isActive: key.is_active !== false,
          })),
        },
      };

    } catch (error) {
      console.error("❌ Get tenant full profile error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async updateTenantConfig(
    programId: string,
    config: {
      earnRateMultiplier?: number;
      memberLimit?: number | null;
      postgridTemplateId?: string | null;
      campaignBudgetCents?: number;
      isSuspended?: boolean;
    }
  ): Promise<{
    success: boolean;
    program?: {
      id: string;
      earnRateMultiplier: number;
      memberLimit: number | null;
      postgridTemplateId: string | null;
      campaignBudgetCents: number;
      isSuspended: boolean;
    };
    error?: string;
  }> {
    console.log(`⚙️ Updating config for program: ${programId}`);
    
    try {
      const client = this.getClient();

      // Check if program exists
      const { data: existingProgram, error: fetchError } = await client
        .from("programs")
        .select("id, name")
        .eq("id", programId)
        .single();

      if (fetchError || !existingProgram) {
        return { success: false, error: "Program not found" };
      }

      const updates: Record<string, any> = {};

      if (config.earnRateMultiplier !== undefined) {
        if (config.earnRateMultiplier < 1 || config.earnRateMultiplier > 1000) {
          return { success: false, error: "Earn rate multiplier must be between 1 and 1000" };
        }
        updates.earn_rate_multiplier = config.earnRateMultiplier;
      }

      if (config.memberLimit !== undefined) {
        if (config.memberLimit !== null && config.memberLimit < 0) {
          return { success: false, error: "Member limit cannot be negative" };
        }
        updates.member_limit = config.memberLimit;
      }

      if (config.postgridTemplateId !== undefined) {
        updates.postgrid_template_id = config.postgridTemplateId;
      }

      if (config.campaignBudgetCents !== undefined) {
        if (config.campaignBudgetCents < 0) {
          return { success: false, error: "Campaign budget cannot be negative" };
        }
        if (config.campaignBudgetCents > 100000000) { // Max $1,000,000
          return { success: false, error: "Campaign budget cannot exceed $1,000,000" };
        }
        updates.campaign_budget_cents = config.campaignBudgetCents;
      }

      if (config.isSuspended !== undefined) {
        updates.is_suspended = config.isSuspended;
      }

      if (Object.keys(updates).length === 0) {
        return { success: false, error: "No valid fields to update" };
      }

      const { data: updatedProgram, error: updateError } = await client
        .from("programs")
        .update(updates)
        .eq("id", programId)
        .select("id, earn_rate_multiplier, member_limit, postgrid_template_id, campaign_budget_cents, is_suspended")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log(`✅ Config updated for program ${programId}`);

      return {
        success: true,
        program: {
          id: updatedProgram.id,
          earnRateMultiplier: updatedProgram.earn_rate_multiplier || 10,
          memberLimit: updatedProgram.member_limit || null,
          postgridTemplateId: updatedProgram.postgrid_template_id || null,
          campaignBudgetCents: updatedProgram.campaign_budget_cents ?? 50000,
          isSuspended: updatedProgram.is_suspended || false,
        },
      };

    } catch (error) {
      console.error("❌ Update tenant config error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ============================================================
  // MULTI-PROGRAM MANAGEMENT METHODS
  // ============================================================

  async addProgramToTenant(params: AddProgramParams): Promise<AddProgramResult> {
    const {
      tenantId,
      name,
      protocol,
      passkitProgramId: providedProgramId,
      passkitTierId: providedTierId,
      timezone = "America/New_York",
      autoProvision = true,
      earnRateMultiplier = 10,
    } = params;

    console.log(`➕ Adding new program to tenant: ${tenantId}`);
    console.log(`   Program Name: ${name}`);
    console.log(`   Protocol: ${protocol}`);

    let passkitData = {
      programId: providedProgramId || null as string | null,
      tierId: providedTierId || null as string | null,
      enrollmentUrl: null as string | null,
      status: "skipped" as "provisioned" | "manual_required" | "skipped",
    };

    try {
      const client = this.getClient();

      // Verify tenant exists
      const { data: authUser, error: authError } = await client.auth.admin.getUserById(tenantId);
      if (authError || !authUser?.user) {
        return { success: false, error: "Tenant not found" };
      }

      // Check for duplicate protocol
      const { data: existingPrograms, error: dupError } = await client
        .from("programs")
        .select("id, protocol")
        .eq("tenant_id", tenantId)
        .eq("protocol", protocol);

      if (dupError) {
        return { success: false, error: `Check failed: ${dupError.message}` };
      }

      if (existingPrograms && existingPrograms.length > 0) {
        return { 
          success: false, 
          error: `Tenant already has a ${protocol} program. Each tenant can only have one program per protocol type.` 
        };
      }

      // Auto-provision PassKit for MEMBERSHIP if requested
      if (autoProvision && !providedProgramId && protocol === "MEMBERSHIP") {
        console.log("🚀 Attempting auto-provision of PassKit program...");
        try {
          const pkResult = await passKitProvisionService.createMembershipProgram({
            clientName: name,
            timezone,
          });
          
          if (pkResult.success && pkResult.programId) {
            passkitData.programId = pkResult.programId;
            passkitData.tierId = pkResult.tierId || null;
            passkitData.enrollmentUrl = pkResult.enrollmentUrl || null;
            passkitData.status = "provisioned";
            console.log(`✅ PassKit auto-provisioned: ${pkResult.programId}`);
          } else {
            console.warn("⚠️ PassKit provisioning failed (soft-fail):", pkResult.error);
            passkitData.status = "manual_required";
          }
        } catch (pkError) {
          console.warn("⚠️ PassKit error (soft-fail):", pkError);
          passkitData.status = "manual_required";
        }
      } else if (providedProgramId) {
        passkitData.programId = providedProgramId;
        passkitData.tierId = providedTierId || null;
        passkitData.status = "provisioned";
      }

      // Check if this is the first program for this tenant
      const { data: programCount } = await client
        .from("programs")
        .select("id", { count: "exact" })
        .eq("tenant_id", tenantId);

      const isFirst = !programCount || programCount.length === 0;

      // Create the program
      const dashboardSlug = short.generate();
      const programInsert: Record<string, any> = {
        name,
        tenant_id: tenantId,
        protocol,
        passkit_program_id: passkitData.programId,
        passkit_tier_id: passkitData.tierId,
        enrollment_url: passkitData.enrollmentUrl,
        passkit_status: passkitData.status,
        dashboard_slug: dashboardSlug,
        timezone,
        earn_rate_multiplier: earnRateMultiplier,
        is_primary: isFirst,
      };

      const { data: programData, error: programError } = await client
        .from("programs")
        .insert(programInsert)
        .select()
        .single();

      if (programError) {
        return { success: false, error: `Program error: ${programError.message}` };
      }

      const programId = programData.id;
      console.log(`✅ Program added: ${programId} (${protocol})`);

      return {
        success: true,
        programId,
        passkitStatus: passkitData.status,
        passkitProgramId: passkitData.programId || undefined,
        passkitTierId: passkitData.tierId || undefined,
        enrollmentUrl: passkitData.enrollmentUrl || undefined,
        dashboardSlug,
      };

    } catch (error) {
      console.error("❌ Add program error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async listTenantPrograms(tenantId: string): Promise<ListTenantProgramsResult> {
    console.log(`📋 Listing programs for tenant: ${tenantId}`);

    try {
      const client = this.getClient();

      const { data: programs, error } = await client
        .from("programs")
        .select(`
          id,
          name,
          protocol,
          passkit_program_id,
          passkit_tier_id,
          passkit_status,
          enrollment_url,
          dashboard_slug,
          timezone,
          earn_rate_multiplier,
          is_suspended,
          is_primary,
          postgrid_template_id,
          member_limit,
          campaign_budget_cents,
          tier_bronze_max,
          tier_silver_max,
          tier_gold_max,
          created_at
        `)
        .eq("tenant_id", tenantId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) {
        return { success: false, error: error.message };
      }

      const formattedPrograms: TenantProgram[] = (programs || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        protocol: p.protocol,
        passkitProgramId: p.passkit_program_id,
        passkitTierId: p.passkit_tier_id,
        passkitStatus: p.passkit_status || "skipped",
        enrollmentUrl: p.enrollment_url,
        dashboardSlug: p.dashboard_slug,
        timezone: p.timezone || "America/New_York",
        earnRateMultiplier: p.earn_rate_multiplier || 10,
        isSuspended: p.is_suspended || false,
        isPrimary: p.is_primary || false,
        postgridTemplateId: p.postgrid_template_id,
        memberLimit: p.member_limit,
        campaignBudgetCents: p.campaign_budget_cents ?? 50000,
        tierBronzeMax: p.tier_bronze_max ?? 999,
        tierSilverMax: p.tier_silver_max ?? 4999,
        tierGoldMax: p.tier_gold_max ?? 14999,
        createdAt: p.created_at,
      }));

      console.log(`✅ Found ${formattedPrograms.length} programs`);
      return { success: true, programs: formattedPrograms };

    } catch (error) {
      console.error("❌ List programs error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async setPrimaryProgram(tenantId: string, programId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🔄 Setting primary program: ${programId} for tenant: ${tenantId}`);

    try {
      const client = this.getClient();

      // Verify the program belongs to this tenant
      const { data: program, error: fetchError } = await client
        .from("programs")
        .select("id, tenant_id")
        .eq("id", programId)
        .single();

      if (fetchError || !program) {
        return { success: false, error: "Program not found" };
      }

      if (program.tenant_id !== tenantId) {
        return { success: false, error: "Program does not belong to this tenant" };
      }

      // Clear existing primary
      await client
        .from("programs")
        .update({ is_primary: false })
        .eq("tenant_id", tenantId);

      // Set new primary
      const { error: updateError } = await client
        .from("programs")
        .update({ is_primary: true })
        .eq("id", programId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log(`✅ Primary program set: ${programId}`);
      return { success: true };

    } catch (error) {
      console.error("❌ Set primary program error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async removeProgram(tenantId: string, programId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🗑️ Removing program: ${programId} from tenant: ${tenantId}`);

    try {
      const client = this.getClient();

      // Verify the program belongs to this tenant
      const { data: program, error: fetchError } = await client
        .from("programs")
        .select("id, tenant_id, is_primary, protocol")
        .eq("id", programId)
        .single();

      if (fetchError || !program) {
        return { success: false, error: "Program not found" };
      }

      if (program.tenant_id !== tenantId) {
        return { success: false, error: "Program does not belong to this tenant" };
      }

      // Check if this is the only program
      const { data: allPrograms, error: countError } = await client
        .from("programs")
        .select("id")
        .eq("tenant_id", tenantId);

      if (countError) {
        return { success: false, error: countError.message };
      }

      if (allPrograms && allPrograms.length <= 1) {
        return { 
          success: false, 
          error: "Cannot delete the only program. Each tenant must have at least one program." 
        };
      }

      // Check for active passes
      const { data: activePasses, error: passError } = await client
        .from("passes_master")
        .select("id")
        .eq("program_id", programId)
        .eq("is_active", true)
        .limit(1);

      if (passError) {
        return { success: false, error: `Check failed: ${passError.message}` };
      }

      if (activePasses && activePasses.length > 0) {
        return { 
          success: false, 
          error: "Cannot delete program with active passes. Deactivate all passes first." 
        };
      }

      // Delete the program
      const { error: deleteError } = await client
        .from("programs")
        .delete()
        .eq("id", programId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      // If this was the primary, set another one as primary
      if (program.is_primary) {
        const { data: remaining } = await client
          .from("programs")
          .select("id")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: true })
          .limit(1);

        if (remaining && remaining.length > 0) {
          await client
            .from("programs")
            .update({ is_primary: true })
            .eq("id", remaining[0].id);
        }
      }

      console.log(`✅ Program removed: ${programId}`);
      return { success: true };

    } catch (error) {
      console.error("❌ Remove program error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async getTenantProgramsByProtocol(tenantId: string, protocol: string): Promise<{ 
    success: boolean; 
    program?: TenantProgram;
    error?: string;
  }> {
    try {
      const client = this.getClient();

      const { data: program, error } = await client
        .from("programs")
        .select(`
          id,
          name,
          protocol,
          passkit_program_id,
          passkit_tier_id,
          passkit_status,
          enrollment_url,
          dashboard_slug,
          timezone,
          earn_rate_multiplier,
          is_suspended,
          is_primary,
          postgrid_template_id,
          member_limit,
          campaign_budget_cents,
          tier_bronze_max,
          tier_silver_max,
          tier_gold_max,
          created_at
        `)
        .eq("tenant_id", tenantId)
        .eq("protocol", protocol)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return { success: false, error: `No ${protocol} program found for this tenant` };
        }
        return { success: false, error: error.message };
      }

      return {
        success: true,
        program: {
          id: program.id,
          name: program.name,
          protocol: program.protocol,
          passkitProgramId: program.passkit_program_id,
          passkitTierId: program.passkit_tier_id,
          passkitStatus: program.passkit_status || "skipped",
          enrollmentUrl: program.enrollment_url,
          dashboardSlug: program.dashboard_slug,
          timezone: program.timezone || "America/New_York",
          earnRateMultiplier: program.earn_rate_multiplier || 10,
          isSuspended: program.is_suspended || false,
          isPrimary: program.is_primary || false,
          postgridTemplateId: program.postgrid_template_id,
          memberLimit: program.member_limit,
          campaignBudgetCents: program.campaign_budget_cents ?? 50000,
          tierBronzeMax: program.tier_bronze_max ?? 999,
          tierSilverMax: program.tier_silver_max ?? 4999,
          tierGoldMax: program.tier_gold_max ?? 14999,
          createdAt: program.created_at,
        },
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  async updateProgramTierThresholds(
    programId: string,
    thresholds: {
      tierBronzeMax: number;
      tierSilverMax: number;
      tierGoldMax: number;
    }
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log(`🔄 Updating tier thresholds for program: ${programId}`);

    try {
      const client = this.getClient();

      // Verify the program exists and is MEMBERSHIP protocol
      const { data: program, error: fetchError } = await client
        .from("programs")
        .select("id, protocol")
        .eq("id", programId)
        .single();

      if (fetchError || !program) {
        return { success: false, error: "Program not found" };
      }

      if (program.protocol !== "MEMBERSHIP") {
        return { 
          success: false, 
          error: "Tier thresholds can only be set for MEMBERSHIP programs" 
        };
      }

      // Update tier thresholds
      const { data: updated, error: updateError } = await client
        .from("programs")
        .update({
          tier_bronze_max: thresholds.tierBronzeMax,
          tier_silver_max: thresholds.tierSilverMax,
          tier_gold_max: thresholds.tierGoldMax,
        })
        .eq("id", programId)
        .select("tier_bronze_max, tier_silver_max, tier_gold_max")
        .single();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      console.log(`✅ Tier thresholds updated for program: ${programId}`, updated);
      return { 
        success: true, 
        data: {
          tierBronzeMax: updated.tier_bronze_max,
          tierSilverMax: updated.tier_silver_max,
          tierGoldMax: updated.tier_gold_max,
        }
      };

    } catch (error) {
      console.error("❌ Update tier thresholds error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export const adminService = new AdminService();
