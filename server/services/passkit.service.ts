import axios, { AxiosInstance } from "axios";
import { config, isPassKitConfigured } from "../config";
import { generatePassKitToken } from "../utils/passkitJWT";
import type { PassKitPass, PassKitUpdate } from "@shared/schema";

const PASSKIT_BASE_URL = 'https://api.pub2.passkit.io';

interface PassKitCreateResponse {
  success: boolean;
  passId?: string;
  downloadUrl?: string;
  error?: string;
}

interface PassKitUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface SyncPassResult {
  passkit_internal_id?: string;
  protocol?: string;
  notification_message?: string;
  new_balance?: number;
  member_name?: string;
  tier_level?: string;
}

class PassKitService {
  private initialized = false;

  private getAuthHeaders(): { Authorization: string } | null {
    const token = generatePassKitToken();
    if (!token) {
      return null;
    }
    return { Authorization: `Bearer ${token}` };
  }

  private getClient(): AxiosInstance {
    const authHeaders = this.getAuthHeaders();
    
    if (!authHeaders) {
      throw new Error("PassKit is not configured. Please set PASSKIT_API_KEY and PASSKIT_API_SECRET environment variables.");
    }

    return axios.create({
      baseURL: PASSKIT_BASE_URL,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      timeout: 30000,
    });
  }

  async healthCheck(): Promise<{ status: "connected" | "disconnected" | "error" }> {
    if (!isPassKitConfigured()) {
      return { status: "disconnected" };
    }

    try {
      const client = this.getClient();
      await client.get("/health");
      this.initialized = true;
      return { status: "connected" };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return { status: "error" };
      }
      return { status: "disconnected" };
    }
  }

  async createPass(passData: PassKitPass): Promise<PassKitCreateResponse> {
    try {
      const client = this.getClient();

      const payload = {
        passTypeIdentifier: passData.passTypeIdentifier,
        serialNumber: passData.serialNumber,
        member: {
          id: passData.memberId,
          name: passData.memberName,
          tierLevel: passData.tierLevel,
          pointsBalance: passData.pointsBalance,
        },
        barcode: passData.barcodeValue ? {
          message: passData.barcodeValue,
          format: "PKBarcodeFormatQR",
        } : undefined,
        expirationDate: passData.expirationDate,
      };

      const response = await client.post("/passes", payload);

      return {
        success: true,
        passId: response.data?.id,
        downloadUrl: response.data?.downloadUrl,
      };
    } catch (error) {
      console.error("PassKit create pass error:", error);
      return {
        success: false,
        error: error instanceof Error 
          ? error.message
          : axios.isAxiosError(error) 
            ? error.response?.data?.message || error.message 
            : "Unknown error occurred",
      };
    }
  }

  async updatePass(updateData: PassKitUpdate): Promise<PassKitUpdateResponse> {
    try {
      const client = this.getClient();

      const payload = {
        updates: {
          pointsBalance: updateData.updates.pointsBalance,
          tierLevel: updateData.updates.tierLevel,
          memberName: updateData.updates.memberName,
          expirationDate: updateData.updates.expirationDate,
        },
      };

      await client.patch(`/passes/${updateData.serialNumber}`, payload);

      return {
        success: true,
        message: "Pass updated successfully",
      };
    } catch (error) {
      console.error("PassKit update pass error:", error);
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  async getPass(serialNumber: string): Promise<PassKitPass | null> {
    try {
      const client = this.getClient();
      const response = await client.get(`/passes/${serialNumber}`);

      if (!response.data) {
        return null;
      }

      return {
        passTypeIdentifier: response.data.passTypeIdentifier,
        serialNumber: response.data.serialNumber,
        memberId: response.data.member?.id,
        memberName: response.data.member?.name,
        tierLevel: response.data.member?.tierLevel,
        pointsBalance: response.data.member?.pointsBalance,
        barcodeValue: response.data.barcode?.message,
        expirationDate: response.data.expirationDate,
      };
    } catch (error) {
      console.error("PassKit get pass error:", error);
      return null;
    }
  }

  async deletePass(serialNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.delete(`/passes/${serialNumber}`);
      return { success: true };
    } catch (error) {
      console.error("PassKit delete pass error:", error);
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  async sendPushNotification(serialNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.post(`/passes/${serialNumber}/push`, { message });
      return { success: true };
    } catch (error) {
      console.error("PassKit push notification error:", error);
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.response?.data?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  async syncPass(rpcResult: SyncPassResult): Promise<{ success: boolean; synced: boolean; mode?: string; error?: string }> {
    const { passkit_internal_id, protocol, notification_message, new_balance } = rpcResult;

    const token = generatePassKitToken();
    if (!token) {
      console.log('⚠️ No PassKit Keys found in .env. Using MOCK mode.');
      console.log(`[Mock Sync] Updated ${protocol} pass ${passkit_internal_id}`);
      return { success: true, synced: false, mode: 'MOCK' };
    }

    console.log(`🔄 Syncing with PassKit (${protocol})...`);

    try {
      const authConfig = {
        headers: { Authorization: `Bearer ${token}` }
      };

      let payload: Record<string, unknown> = {
        changeMessage: notification_message
      };

      let url = '';

      switch (protocol) {
        case 'MEMBERSHIP':
          // PassKit API uses /members/member with externalId in the body
          url = `${PASSKIT_BASE_URL}/members/member`;
          payload.externalId = passkit_internal_id;  // Use externalId to identify member
          payload.points = new_balance;
          await axios.put(url, payload, authConfig);
          break;

        case 'COUPON':
          url = `${PASSKIT_BASE_URL}/coupons/coupon/${passkit_internal_id}/redeem`;
          await axios.put(url, payload, authConfig);
          break;

        case 'EVENT_TICKET':
          url = `${PASSKIT_BASE_URL}/flights/boardingPass/${passkit_internal_id}/redeem`;
          await axios.put(url, payload, authConfig);
          break;

        default:
          console.warn('Unknown Protocol:', protocol);
          return { success: true, synced: false, mode: 'UNKNOWN_PROTOCOL' };
      }

      console.log(`✅ PassKit Sync Success: ${passkit_internal_id}`);
      this.initialized = true;
      return { success: true, synced: true };

    } catch (error) {
      let errorMessage = 'PassKit Sync Failed';
      let errorDetails: Record<string, unknown> = {};
      
      if (axios.isAxiosError(error)) {
        errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
        };
        errorMessage = `PassKit API Error: ${error.response?.status} ${error.response?.statusText || ''} - ${JSON.stringify(error.response?.data) || error.message}`;
      } else if (error instanceof Error) {
        errorMessage = `PassKit Sync Failed: ${error.message}`;
      }
      
      console.error('❌ PassKit API Error:', errorDetails);
      throw new Error(errorMessage);
    }
  }

  isInitialized(): boolean {
    return this.initialized && isPassKitConfigured();
  }
}

export const passKitService = new PassKitService();
