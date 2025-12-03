import axios, { AxiosInstance } from "axios";
import { config, isPostGridConfigured } from "../config";
import type { PostGridMail, PostGridMailResponse, PostGridPostcard, PostGridPostcardResponse, PostGridLetter, PostGridLetterResponse } from "@shared/schema";

interface PostGridLetterApiResponse {
  id: string;
  status: string;
  estimatedDeliveryDate?: string;
}

interface PostGridPostcardApiResponse {
  id: string;
  status: string;
  estimatedDeliveryDate?: string;
  to?: {
    firstName?: string;
    lastName?: string;
  };
}

class PostGridService {
  private client: AxiosInstance | null = null;
  private initialized = false;

  private getClient(): AxiosInstance {
    if (!this.client) {
      if (!isPostGridConfigured()) {
        throw new Error("PostGrid is not configured. Please set POSTGRID_API_KEY environment variable.");
      }

      this.client = axios.create({
        baseURL: config.postGrid.apiUrl,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.postGrid.apiKey,
        },
        timeout: 30000,
      });

      this.initialized = true;
    }
    return this.client;
  }

  async healthCheck(): Promise<{ status: "connected" | "disconnected" | "error" }> {
    if (!isPostGridConfigured()) {
      return { status: "disconnected" };
    }

    try {
      const client = this.getClient();
      await client.get("/templates?limit=1");
      return { status: "connected" };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        return { status: "error" };
      }
      return { status: "disconnected" };
    }
  }

  async sendDirectMail(mailData: PostGridMail): Promise<PostGridMailResponse> {
    try {
      const client = this.getClient();

      const payload = {
        template: mailData.templateId,
        to: {
          name: mailData.recipientAddress.name,
          addressLine1: mailData.recipientAddress.addressLine1,
          addressLine2: mailData.recipientAddress.addressLine2,
          city: mailData.recipientAddress.city,
          provinceOrState: mailData.recipientAddress.state,
          postalOrZip: mailData.recipientAddress.postalCode,
          country: mailData.recipientAddress.country,
        },
        mergeVariables: {
          memberId: mailData.memberId,
          ...mailData.mergeVariables,
        },
        sendDate: mailData.sendDate,
      };

      const response = await client.post<PostGridLetterApiResponse>("/letters", payload);

      return {
        success: true,
        mailId: response.data.id,
        status: response.data.status,
        estimatedDeliveryDate: response.data.estimatedDeliveryDate,
        message: "Direct mail queued successfully",
      };
    } catch (error) {
      console.error("PostGrid send mail error:", error);
      return {
        success: false,
        error: error instanceof Error 
          ? error.message
          : axios.isAxiosError(error)
            ? error.response?.data?.error?.message || error.message
            : "Unknown error occurred",
      };
    }
  }

  async sendPostcard(postcardData: PostGridPostcard): Promise<PostGridPostcardResponse> {
    try {
      const client = this.getClient();

      const recipientName = postcardData.recipientAddress.lastName 
        ? `${postcardData.recipientAddress.firstName} ${postcardData.recipientAddress.lastName}`
        : postcardData.recipientAddress.firstName;

      const payload: Record<string, any> = {
        size: postcardData.size || "6x4",
        to: {
          firstName: postcardData.recipientAddress.firstName,
          lastName: postcardData.recipientAddress.lastName || '',
          addressLine1: postcardData.recipientAddress.addressLine1,
          addressLine2: postcardData.recipientAddress.addressLine2,
          city: postcardData.recipientAddress.city,
          provinceOrState: postcardData.recipientAddress.state,
          postalOrZip: postcardData.recipientAddress.postalCode,
          country: postcardData.recipientAddress.country,
        },
        from: postcardData.senderAddress || {
          companyName: "Pass2VIP Loyalty Program",
          addressLine1: "123 Main Street",
          city: "San Francisco",
          provinceOrState: "CA",
          postalOrZip: "94102",
          country: "US",
        },
        mergeVariables: {
          firstName: postcardData.recipientAddress.firstName,
          lastName: postcardData.recipientAddress.lastName || '',
          fullName: recipientName,
          qrCodeUrl: postcardData.claimUrl || '',
          claimCode: postcardData.claimCode,
          ...postcardData.mergeVariables,
        },
        sendDate: postcardData.sendDate,
      };

      if (postcardData.frontTemplateId && postcardData.backTemplateId) {
        payload.frontTemplate = postcardData.frontTemplateId;
        payload.backTemplate = postcardData.backTemplateId;
      } else if (postcardData.templateId) {
        payload.frontTemplate = postcardData.templateId;
        payload.backTemplate = postcardData.templateId;
      }

      console.log(`📮 Sending postcard to ${recipientName} with claim code: ${postcardData.claimCode}`);

      const response = await client.post<PostGridPostcardApiResponse>("/postcards", payload);

      console.log(`✅ Postcard queued: ${response.data.id}`);

      return {
        success: true,
        postcardId: response.data.id,
        status: response.data.status,
        estimatedDeliveryDate: response.data.estimatedDeliveryDate,
        claimCode: postcardData.claimCode,
        claimUrl: postcardData.claimUrl,
        message: "Postcard queued successfully",
      };
    } catch (error) {
      let errorMessage = "Unknown error occurred";
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        errorMessage = responseData?.error?.message 
          || responseData?.message 
          || JSON.stringify(responseData?.error) 
          || error.message;
        console.error("PostGrid send postcard error:", JSON.stringify(responseData, null, 2));
      } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error("PostGrid send postcard error:", error);
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async sendLetter(letterData: PostGridLetter): Promise<PostGridLetterResponse> {
    try {
      const client = this.getClient();

      const recipientName = letterData.recipientAddress.lastName 
        ? `${letterData.recipientAddress.firstName} ${letterData.recipientAddress.lastName}`
        : letterData.recipientAddress.firstName;

      const payload: Record<string, any> = {
        template: letterData.templateId,
        to: {
          firstName: letterData.recipientAddress.firstName,
          lastName: letterData.recipientAddress.lastName || '',
          addressLine1: letterData.recipientAddress.addressLine1,
          addressLine2: letterData.recipientAddress.addressLine2,
          city: letterData.recipientAddress.city,
          provinceOrState: letterData.recipientAddress.state,
          postalOrZip: letterData.recipientAddress.postalCode,
          country: letterData.recipientAddress.country,
        },
        from: letterData.senderAddress || {
          companyName: "Pass2VIP Loyalty Program",
          addressLine1: "123 Main Street",
          city: "San Francisco",
          provinceOrState: "CA",
          postalOrZip: "94102",
          country: "US",
        },
        mergeVariables: {
          firstName: letterData.recipientAddress.firstName,
          lastName: letterData.recipientAddress.lastName || '',
          fullName: recipientName,
          qrCodeUrl: letterData.claimUrl || '',
          claimCode: letterData.claimCode,
          ...letterData.mergeVariables,
        },
        addressPlacement: letterData.addressPlacement || 'top_first_page',
        doubleSided: letterData.doubleSided !== false,
        color: letterData.color !== false,
        sendDate: letterData.sendDate,
      };

      if (letterData.description) {
        payload.description = letterData.description;
      }

      console.log(`📮 Sending letter to ${recipientName} with claim code: ${letterData.claimCode}`);

      const response = await client.post<PostGridLetterApiResponse>("/letters", payload);

      console.log(`✅ Letter queued: ${response.data.id}`);

      return {
        success: true,
        letterId: response.data.id,
        status: response.data.status,
        estimatedDeliveryDate: response.data.estimatedDeliveryDate,
        claimCode: letterData.claimCode,
        claimUrl: letterData.claimUrl,
        message: "Letter queued successfully",
      };
    } catch (error) {
      let errorMessage = "Unknown error occurred";
      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data;
        errorMessage = responseData?.error?.message 
          || responseData?.message 
          || JSON.stringify(responseData?.error) 
          || error.message;
        console.error("PostGrid send letter error:", JSON.stringify(responseData, null, 2));
      } else if (error instanceof Error) {
        errorMessage = error.message;
        console.error("PostGrid send letter error:", error);
      }
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getMailStatus(mailId: string): Promise<PostGridMailResponse> {
    try {
      const client = this.getClient();
      const response = await client.get<PostGridLetterApiResponse>(`/letters/${mailId}`);

      return {
        success: true,
        mailId: response.data.id,
        status: response.data.status,
        estimatedDeliveryDate: response.data.estimatedDeliveryDate,
      };
    } catch (error) {
      console.error("PostGrid get status error:", error);
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.response?.data?.error?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  async cancelMail(mailId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.delete(`/letters/${mailId}`);
      return { success: true };
    } catch (error) {
      console.error("PostGrid cancel mail error:", error);
      return {
        success: false,
        error: axios.isAxiosError(error)
          ? error.response?.data?.error?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  async listTemplates(): Promise<{ templates: any[]; error?: string }> {
    try {
      const client = this.getClient();
      const response = await client.get("/templates");
      return { templates: response.data?.data || [] };
    } catch (error) {
      console.error("PostGrid list templates error:", error);
      return {
        templates: [],
        error: axios.isAxiosError(error)
          ? error.response?.data?.error?.message || error.message
          : "Unknown error occurred",
      };
    }
  }

  isInitialized(): boolean {
    return this.initialized && isPostGridConfigured();
  }
}

export const postGridService = new PostGridService();
