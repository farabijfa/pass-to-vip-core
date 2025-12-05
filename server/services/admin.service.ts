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
}

interface CreateTenantResult {
  success: boolean;
  userId?: string;
  programId?: string;
  email?: string;
  businessName?: string;
  dashboardSlug?: string;
  dashboardUrl?: string;
  passkitStatus?: "provisioned" | "manual_required" | "skipped";
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
    } = params;

    console.log(`🏢 Creating new tenant: ${businessName}`);
    console.log(`   Email: ${email}`);
    console.log(`   Protocol: ${protocol}`);
    console.log(`   Auto-Provision: ${autoProvision}`);
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
        protocol: protocol,
      };
      
      if (hasDashboardSlug) {
        programInsert.dashboard_slug = dashboardSlug;
        console.log(`   Dashboard slug: ${dashboardSlug}`);
      }
      
      console.log(`   PassKit Program ID: ${passkitData.programId || "PENDING"}`);
      console.log(`   PassKit Tier ID: ${passkitData.tierId || "PENDING"}`);
      console.log(`   Enrollment URL: ${passkitData.enrollmentUrl || "PENDING"}`);
      
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
            protocol,
            is_suspended,
            dashboard_slug,
            enrollment_url
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
}

export const adminService = new AdminService();
