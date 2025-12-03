import axios, { AxiosInstance } from "axios";
import { config, isPassKitConfigured } from "../config";
import type { PassKitPass, PassKitUpdate } from "@shared/schema";

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

class PassKitService {
  private client: AxiosInstance | null = null;
  private initialized = false;

  private getClient(): AxiosInstance {
    if (!this.client) {
      if (!isPassKitConfigured()) {
        throw new Error("PassKit is not configured. Please set PASSKIT_API_KEY and PASSKIT_API_SECRET environment variables.");
      }

      this.client = axios.create({
        baseURL: config.passKit.apiUrl,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.passKit.apiKey}`,
          "X-API-Secret": config.passKit.apiSecret,
        },
        timeout: 30000,
      });

      this.initialized = true;
    }
    return this.client;
  }

  async healthCheck(): Promise<{ status: "connected" | "disconnected" | "error" }> {
    if (!isPassKitConfigured()) {
      return { status: "disconnected" };
    }

    try {
      const client = this.getClient();
      await client.get("/health");
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
        error: axios.isAxiosError(error) 
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

  isInitialized(): boolean {
    return this.initialized && isPassKitConfigured();
  }
}

export const passKitService = new PassKitService();
