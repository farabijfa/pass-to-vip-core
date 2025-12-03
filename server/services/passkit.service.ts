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
  passkit_program_id?: string;
  protocol?: string;
  notification_message?: string;
  new_balance?: number;
  member_name?: string;
  tier_level?: string;
}

interface EnrollMemberData {
  email: string;
  firstName?: string;
  lastName?: string;
  points?: number;
  tierId?: string;
}

interface EnrollMemberResult {
  success: boolean;
  passkit_internal_id?: string;
  external_id?: string;
  install_url?: string;
  error?: string;
}

interface IssueCouponData {
  campaignId: string;
  offerId: string;
  externalId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  sku?: string;
}

interface IssueCouponResult {
  success: boolean;
  coupon_id?: string;
  external_id?: string;
  install_url?: string;
  error?: string;
}

// TODO: EVENT_TICKET - Requires Production → Venue → Event hierarchy setup in PassKit
interface IssueEventTicketData {
  productionId: string;
  ticketTypeId: string;
  eventId?: string;
  ticketNumber?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  seat?: {
    section?: string;
    row?: string;
    seat?: string;
  };
}

interface IssueEventTicketResult {
  success: boolean;
  ticket_id?: string;
  ticket_number?: string;
  install_url?: string;
  error?: string;
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
          // PassKit API uses /members/member with externalId + programId in the body
          url = `${PASSKIT_BASE_URL}/members/member`;
          payload.externalId = passkit_internal_id;
          payload.programId = rpcResult.passkit_program_id || '4RhsVhHek0dliVogVznjSQ';
          payload.points = new_balance;
          await axios.put(url, payload, authConfig);
          break;

        case 'COUPON':
          // PassKit Single Use Coupon API: PUT /coupon/singleUse/coupon/{id}/redeem
          url = `${PASSKIT_BASE_URL}/coupon/singleUse/coupon/${passkit_internal_id}/redeem`;
          await axios.put(url, payload, authConfig);
          break;

        case 'EVENT_TICKET':
          // TODO: EVENT_TICKET - Placeholder mode; skip PassKit sync until Venue/Event configured
          console.log('⚠️ EVENT_TICKET sync skipped - placeholder mode. See TODO in passkit.service.ts');
          return { success: true, synced: false, mode: 'EVENT_TICKET_PLACEHOLDER' };
          // Uncomment below once eventId is available:
          // url = `${PASSKIT_BASE_URL}/eventTickets/ticket/${passkit_internal_id}/redeem`;
          // await axios.put(url, payload, authConfig);
          // break;

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

  async enrollMember(
    passkitProgramId: string,
    userData: EnrollMemberData
  ): Promise<EnrollMemberResult> {
    const token = generatePassKitToken();
    
    if (!token) {
      console.log('⚠️ No PassKit Keys found. Using MOCK mode for enrollment.');
      return {
        success: true,
        passkit_internal_id: `MOCK-${Date.now()}`,
        external_id: userData.email,
        install_url: `https://mock.passkit.io/install/${userData.email}`,
      };
    }

    console.log(`🎫 Enrolling new member in program: ${passkitProgramId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/member`;
      
      const payload: Record<string, unknown> = {
        programId: passkitProgramId,
        externalId: userData.email,
        points: userData.points || 0,
        person: {
          forename: userData.firstName || '',
          surname: userData.lastName || '',
          emailAddress: userData.email,
        },
      };

      if (userData.tierId) {
        payload.tierId = userData.tierId;
      }

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      console.log(`✅ Member enrolled successfully: ${response.data?.id}`);

      return {
        success: true,
        passkit_internal_id: response.data?.id,
        external_id: response.data?.externalId || userData.email,
        install_url: response.data?.passUrl || response.data?.url,
      };
    } catch (error) {
      let errorMessage = 'PassKit Enrollment Failed';
      
      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit Enrollment Error:', {
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

  async issueCoupon(couponData: IssueCouponData): Promise<IssueCouponResult> {
    const token = generatePassKitToken();
    
    if (!token) {
      console.log('⚠️ No PassKit Keys found. Using MOCK mode for coupon issuance.');
      const mockExternalId = couponData.externalId || `CPN-${Date.now()}`;
      return {
        success: true,
        coupon_id: `MOCK-COUPON-${Date.now()}`,
        external_id: mockExternalId,
        install_url: `https://mock.passkit.io/coupon/${mockExternalId}`,
      };
    }

    console.log(`🎟️ Issuing coupon for campaign: ${couponData.campaignId}, offer: ${couponData.offerId}`);

    try {
      // PassKit Single Use Coupon API: POST /coupon/singleUse/coupon
      const url = `${PASSKIT_BASE_URL}/coupon/singleUse/coupon`;
      
      const payload: Record<string, unknown> = {
        campaignId: couponData.campaignId,
        offerId: couponData.offerId,
      };

      if (couponData.externalId) {
        payload.externalId = couponData.externalId;
      }

      if (couponData.sku) {
        payload.sku = couponData.sku;
      }

      if (couponData.email || couponData.firstName || couponData.lastName) {
        payload.person = {
          emailAddress: couponData.email,
          forename: couponData.firstName,
          surname: couponData.lastName,
        };
      }

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      console.log(`✅ Coupon issued successfully: ${response.data?.id}`);

      return {
        success: true,
        coupon_id: response.data?.id,
        external_id: response.data?.externalId || couponData.externalId,
        install_url: response.data?.passUrl || response.data?.url,
      };
    } catch (error) {
      let errorMessage = 'PassKit Coupon Issuance Failed';
      
      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit Coupon Error:', {
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

  // ============================================================================
  // TODO: EVENT_TICKET PROTOCOL - PLACEHOLDER
  // ============================================================================
  // PassKit Event Tickets require a full hierarchy before issuance:
  //   1. Production (have: 68354tE85PxHKqRMTzUhdq)
  //   2. Venue (need to create in PassKit dashboard or via API)
  //   3. Event (links Production + Venue + Date)
  //   4. Ticket Type (have: 1lhTkqdRkfcYCNTxpfRmLJ)
  //
  // Once you have a Venue and Event created, update this function with:
  //   - eventId: The PassKit Event ID
  //   - Uncomment the API call below
  //
  // API Endpoint: POST /eventTickets/ticket
  // Docs: https://docs.passkit.io/protocols/event-tickets/
  // ============================================================================
  async issueEventTicket(ticketData: IssueEventTicketData): Promise<IssueEventTicketResult> {
    // TODO: EVENT_TICKET - Remove placeholder mode once Venue + Event are configured
    console.log('⚠️ Event Tickets in PLACEHOLDER mode. Requires Venue + Event setup in PassKit.');
    console.log(`[Placeholder] Would issue ticket for production: ${ticketData.productionId}, ticketType: ${ticketData.ticketTypeId}`);
    
    // Return mock data until Event hierarchy is complete
    const ticketNumber = ticketData.ticketNumber || `TKT-${Date.now()}`;
    return {
      success: true,
      ticket_id: `PLACEHOLDER-${Date.now()}`,
      ticket_number: ticketNumber,
      install_url: `https://placeholder.passkit.io/ticket/${ticketNumber}`,
      error: 'EVENT_TICKET protocol requires Venue + Event setup. See TODO in passkit.service.ts',
    };

    /* TODO: EVENT_TICKET - Uncomment this block once eventId is available
    const token = generatePassKitToken();
    
    if (!token) {
      console.log('⚠️ No PassKit Keys found. Using MOCK mode for ticket issuance.');
      return {
        success: true,
        ticket_id: `MOCK-TICKET-${Date.now()}`,
        ticket_number: ticketData.ticketNumber || `TKT-${Date.now()}`,
        install_url: `https://mock.passkit.io/ticket/${ticketData.ticketNumber}`,
      };
    }

    console.log(`🎟️ Issuing event ticket for production: ${ticketData.productionId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/eventTickets/ticket`;
      
      const payload: Record<string, unknown> = {
        ticketType: { id: ticketData.ticketTypeId },
        event: { id: ticketData.eventId },
        ticketNumber: ticketData.ticketNumber || `TKT-${Date.now()}`,
      };

      if (ticketData.email || ticketData.firstName || ticketData.lastName) {
        payload.person = {
          emailAddress: ticketData.email,
          forename: ticketData.firstName,
          surname: ticketData.lastName,
        };
      }

      if (ticketData.seat) {
        payload.seat = ticketData.seat;
      }

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      console.log(`✅ Event ticket issued successfully: ${response.data?.id}`);

      return {
        success: true,
        ticket_id: response.data?.id,
        ticket_number: response.data?.ticketNumber || ticketData.ticketNumber,
        install_url: response.data?.passUrl || response.data?.url,
      };
    } catch (error) {
      let errorMessage = 'PassKit Event Ticket Issuance Failed';
      
      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit Event Ticket Error:', {
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
    */
  }

  // TODO: EVENT_TICKET - Placeholder for ticket redemption
  async redeemEventTicket(ticketId: string): Promise<{ success: boolean; error?: string }> {
    console.log('⚠️ Event Ticket Redemption in PLACEHOLDER mode.');
    console.log(`[Placeholder] Would redeem ticket: ${ticketId}`);
    return { 
      success: true,
      error: 'EVENT_TICKET protocol in placeholder mode. See TODO in passkit.service.ts',
    };
  }

  // TODO: EVENT_TICKET - Placeholder for ticket validation
  async validateEventTicket(ticketId: string): Promise<{ success: boolean; valid?: boolean; error?: string }> {
    console.log('⚠️ Event Ticket Validation in PLACEHOLDER mode.');
    console.log(`[Placeholder] Would validate ticket: ${ticketId}`);
    return { 
      success: true, 
      valid: true,
      error: 'EVENT_TICKET protocol in placeholder mode. See TODO in passkit.service.ts',
    };
  }
}

export const passKitService = new PassKitService();
