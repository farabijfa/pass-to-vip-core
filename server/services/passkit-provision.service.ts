import axios from "axios";
import { generatePassKitToken } from "../utils/passkitJWT";
import { config } from "../config";

const PASSKIT_BASE_URL = "https://api.pub2.passkit.io";

interface PassKitProgramResult {
  success: boolean;
  programId?: string;
  tierId?: string;
  enrollmentUrl?: string;
  error?: string;
  mode?: "LIVE" | "MOCK";
}

interface CreateProgramOptions {
  clientName: string;
  timezone?: string;
  country?: string;
  defaultTierName?: string;
}

class PassKitProvisionService {
  private getAuthHeaders(): { Authorization: string } | null {
    const token = generatePassKitToken();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }

  async createMembershipProgram(options: CreateProgramOptions): Promise<PassKitProgramResult> {
    const {
      clientName,
      timezone = "America/New_York",
      country = "US",
      defaultTierName = "Standard Member",
    } = options;

    const authHeaders = this.getAuthHeaders();

    if (!authHeaders) {
      console.log("⚠️ PassKit not configured. Using MOCK mode for provisioning.");
      const mockProgramId = `MOCK-PROG-${Date.now()}`;
      const mockTierId = `MOCK-TIER-${Date.now()}`;
      return {
        success: true,
        programId: mockProgramId,
        tierId: mockTierId,
        enrollmentUrl: `https://mock.pskt.io/c/${mockTierId}`,
        mode: "MOCK",
      };
    }

    console.log(`🚀 PassKit Provisioning: Creating program for "${clientName}"...`);

    try {
      const headers = {
        "Content-Type": "application/json",
        ...authHeaders,
      };

      const programPayload = {
        name: clientName,
        status: ["PROJECT_DRAFT"],
        localizedName: {
          en: clientName,
        },
        pointsType: {
          one: "point",
          few: "points",
          many: "points",
          other: "points",
          balanceDisplayFormat: "BALANCE_DISPLAY_INTEGER",
        },
        expiry: {
          expiryType: "EXPIRE_NONE",
        },
        autoDeleteDaysAfterExpiry: 90,
        autoDeleteDaysAfterNotInstalling: 30,
      };

      console.log("📦 Step 1: Creating PassKit Program...");
      const programRes = await axios.post(
        `${PASSKIT_BASE_URL}/members/program`,
        programPayload,
        { headers, timeout: 30000 }
      );

      if (!programRes.data?.id) {
        throw new Error("PassKit API did not return a program ID");
      }

      const programId = programRes.data.id;
      console.log(`✅ Program created: ${programId}`);

      const tierPayload = {
        programId: programId,
        id: "standard",
        name: defaultTierName,
        localizedName: {
          en: defaultTierName,
        },
        timezone: timezone,
        passTypeIdentifier: "pass.io.passkit.loyalty",
        expirySettings: {
          expiryType: "EXPIRE_NONE",
        },
      };

      console.log("🎫 Step 2: Creating Base Tier...");
      const tierRes = await axios.post(
        `${PASSKIT_BASE_URL}/members/tier`,
        tierPayload,
        { headers, timeout: 30000 }
      );

      if (!tierRes.data?.id) {
        throw new Error("PassKit API did not return a tier ID");
      }

      const tierId = tierRes.data.id;
      console.log(`✅ Tier created: ${tierId}`);

      const enrollmentUrl = `https://pub2.pskt.io/c/${tierId}`;
      console.log(`🔗 Enrollment URL: ${enrollmentUrl}`);

      console.log("🎉 PassKit Provisioning Complete!");
      console.log(`   Program ID: ${programId}`);
      console.log(`   Tier ID: ${tierId}`);
      console.log(`   Enrollment URL: ${enrollmentUrl}`);

      return {
        success: true,
        programId,
        tierId,
        enrollmentUrl,
        mode: "LIVE",
      };

    } catch (error) {
      let errorMessage = "PassKit Provisioning Failed";
      let errorDetails: Record<string, unknown> = {};

      if (axios.isAxiosError(error)) {
        errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        };
        errorMessage = `PassKit API Error: ${error.response?.status} ${error.response?.statusText || ""} - ${JSON.stringify(error.response?.data) || error.message}`;
        console.error("❌ PassKit API Error:", errorDetails);
      } else if (error instanceof Error) {
        errorMessage = `PassKit Provisioning Error: ${error.message}`;
        console.error("❌ PassKit Error:", error.message);
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async retryProvision(
    programDbId: string,
    options: CreateProgramOptions
  ): Promise<PassKitProgramResult> {
    console.log(`🔄 Retry provisioning for program DB ID: ${programDbId}`);
    return this.createMembershipProgram(options);
  }

  isConfigured(): boolean {
    return !!config.passKit.apiKey && !!config.passKit.apiSecret;
  }
}

export const passKitProvisionService = new PassKitProvisionService();
