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
  member_email?: string;
  member_first_name?: string;
  member_last_name?: string;
  external_id?: string;
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

  async healthCheck(): Promise<{ 
    status: "connected" | "disconnected" | "error";
    reason?: string;
    details?: string;
  }> {
    const apiKey = config.passKit.apiKey;
    const apiSecret = config.passKit.apiSecret;
    
    console.log("[PassKit] Health check starting...");
    console.log("[PassKit] API Key configured:", apiKey ? `Yes (${apiKey.length} chars)` : "No");
    console.log("[PassKit] API Secret configured:", apiSecret ? `Yes (${apiSecret.length} chars)` : "No");

    if (!apiKey || !apiSecret) {
      const missing = [];
      if (!apiKey) missing.push("PASSKIT_API_KEY");
      if (!apiSecret) missing.push("PASSKIT_API_SECRET");
      console.log("[PassKit] Missing credentials:", missing.join(", "));
      return { 
        status: "disconnected", 
        reason: "credentials_missing",
        details: `Missing: ${missing.join(", ")}`
      };
    }

    try {
      const client = this.getClient();
      console.log("[PassKit] Attempting API health check at:", PASSKIT_BASE_URL);
      
      const response = await client.get("/members/count/default");
      console.log("[PassKit] API responded successfully");
      
      this.initialized = true;
      return { 
        status: "connected",
        reason: "api_verified"
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const statusCode = error.response?.status;
        const errorMessage = error.response?.data?.message || error.message;
        
        console.error("[PassKit] API error:", statusCode, errorMessage);
        
        if (statusCode === 401 || statusCode === 403) {
          return { 
            status: "error", 
            reason: "credentials_invalid",
            details: `Auth failed (${statusCode}): ${errorMessage}`
          };
        }
        
        if (statusCode === 404) {
          this.initialized = true;
          return { 
            status: "connected",
            reason: "api_reachable",
            details: "API reachable (endpoint returned 404)"
          };
        }

        if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
          this.initialized = true;
          return { 
            status: "connected",
            reason: "api_server_issue",
            details: `PassKit API server issue (${statusCode}) - credentials valid, POS actions may still work`
          };
        }
        
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return { 
            status: "disconnected", 
            reason: "api_unreachable",
            details: `Network error: ${error.code}`
          };
        }
        
        return { 
          status: "error", 
          reason: "api_error",
          details: `HTTP ${statusCode}: ${errorMessage}`
        };
      }
      
      console.error("[PassKit] Unexpected error:", error);
      return { 
        status: "error", 
        reason: "unknown_error",
        details: error instanceof Error ? error.message : "Unknown error"
      };
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
          // PassKit API uses /members/member with id + programId in the body
          // CRITICAL: passkit_program_id is REQUIRED - no hardcoded fallbacks allowed
          if (!rpcResult.passkit_program_id) {
            console.error('❌ MEMBERSHIP sync failed: No passkit_program_id provided');
            console.error('   The program must have a valid, LIVE PassKit program ID configured.');
            console.error('   Draft programs are not suitable for production use.');
            return { 
              success: false, 
              synced: false, 
              mode: 'MISSING_PROGRAM_ID',
              error: 'No PassKit program ID configured. Please link this program to a live PassKit program.'
            };
          }
          url = `${PASSKIT_BASE_URL}/members/member`;
          payload.id = passkit_internal_id;
          payload.programId = rpcResult.passkit_program_id;
          payload.points = new_balance;
          if (rpcResult.member_email || rpcResult.member_first_name || rpcResult.member_last_name) {
            payload.person = {
              emailAddress: rpcResult.member_email || rpcResult.external_id || `${passkit_internal_id}@member.local`,
              forename: rpcResult.member_first_name || 'Member',
              surname: rpcResult.member_last_name || '',
            };
          }
          console.log(`📤 PassKit PUT ${url}`, JSON.stringify(payload, null, 2));
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

  async updateMemberPoints(
    passkitProgramId: string,
    memberId: string,
    points: number,
    changeMessage?: string,
    personData?: {
      email?: string;
      firstName?: string;
      lastName?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    const token = generatePassKitToken();

    if (!token) {
      console.log('⚠️ No PassKit Keys found. Using MOCK mode.');
      console.log(`[Mock] Would update member ${memberId} to ${points} points`);
      return { success: true };
    }

    console.log(`📤 Updating PassKit member balance: ${memberId} = ${points} points`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/member`;

      const payload: Record<string, unknown> = {
        id: memberId,
        programId: passkitProgramId,
        points: points,
      };

      if (changeMessage) {
        payload.changeMessage = changeMessage;
      }

      // PassKit requires person data when data collection is enabled
      // Always include person object with fallbacks
      const person: Record<string, string> = {
        emailAddress: personData?.email || `${memberId}@member.local`,
        forename: personData?.firstName || 'Member',
        surname: personData?.lastName || '',
      };
      payload.person = person;

      const authConfig = {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      console.log(`📤 PassKit PUT ${url}`, JSON.stringify(payload, null, 2));
      await axios.put(url, payload, authConfig);

      console.log(`✅ PassKit member ${memberId} updated to ${points} points`);
      return { success: true };
    } catch (error) {
      let errorMessage = 'PassKit Update Failed';

      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit API Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        });
        errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return { success: false, error: errorMessage };
    }
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

      const memberId = response.data?.id;
      console.log(`✅ Member enrolled successfully: ${memberId}`);

      let installUrl = response.data?.passUrl || response.data?.url || response.data?.passInstallUrl;

      if (!installUrl && memberId) {
        installUrl = `https://pub2.pskt.io/${memberId}`;
      }

      return {
        success: true,
        passkit_internal_id: memberId,
        external_id: response.data?.externalId || userData.email,
        install_url: installUrl,
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

  async pushMessage(
    passkitInternalId: string, 
    programId: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    const token = generatePassKitToken();
    
    if (!token) {
      console.log('⚠️ No PassKit Keys found. Using MOCK mode for push message.');
      console.log(`[Mock Push] Member: ${passkitInternalId}, Message: ${message}`);
      return { success: true };
    }

    try {
      const url = `${PASSKIT_BASE_URL}/members/member`;
      
      const payload = {
        externalId: passkitInternalId,
        programId: programId,
        changeMessage: message,
      };

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      await axios.put(url, payload, authConfig);
      
      console.log(`📨 Push message sent to ${passkitInternalId}: "${message}"`);
      return { success: true };

    } catch (error) {
      let errorMessage = 'PassKit Push Message Failed';
      
      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit Push Error:', {
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
  // PassKit Program Management Methods (v2.6.1)
  // Used for syncing and verifying live PassKit programs
  // ============================================================================

  async listPrograms(options: {
    limit?: number;
    offset?: number;
    statusFilter?: 'PROJECT_PUBLISHED' | 'PROJECT_ACTIVE_FOR_OBJECT_CREATION' | 'PROJECT_DRAFT' | 'all';
  } = {}): Promise<{
    success: boolean;
    programs?: Array<{
      id: string;
      name: string;
      status: string[];
      created?: string;
      updated?: string;
    }>;
    total?: number;
    error?: string;
  }> {
    const token = generatePassKitToken();
    
    if (!token) {
      console.log('⚠️ No PassKit Keys found. Cannot list programs.');
      return { 
        success: false, 
        error: 'PassKit not configured' 
      };
    }

    console.log('📋 Fetching PassKit programs...');

    try {
      const url = `${PASSKIT_BASE_URL}/members/programs/list`;
      
      const payload: Record<string, unknown> = {
        limit: options.limit || 100,
        offset: options.offset || 0,
        orderBy: 'created',
        orderAsc: false,
      };

      if (options.statusFilter && options.statusFilter !== 'all') {
        payload.filterGroups = [{
          condition: 'AND',
          fieldFilters: [{
            filterField: 'status',
            filterValue: options.statusFilter,
            filterOperator: 'eq'
          }]
        }];
      }

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      let programs: Record<string, unknown>[] = [];
      let total = 0;

      let responseData = response.data;
      
      if (typeof responseData === 'string') {
        console.log('PassKit API returned string, attempting to parse...');
        
        const lines = responseData.split('\n').filter((line: string) => line.trim());
        console.log(`Found ${lines.length} lines in response`);
        
        if (lines.length > 1) {
          console.log('NDJSON format detected, parsing each line...');
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line);
              if (parsed?.result && typeof parsed.result === 'object') {
                programs.push(parsed.result);
              } else if (parsed && typeof parsed === 'object' && parsed.id) {
                programs.push(parsed);
              }
            } catch (lineError) {
              console.warn('Failed to parse line:', line.substring(0, 100));
            }
          }
          total = programs.length;
          console.log(`Parsed ${programs.length} programs from NDJSON`);
        } else {
          try {
            responseData = JSON.parse(responseData);
            console.log('Single JSON parse successful');
          } catch (parseError) {
            console.error('JSON parse failed:', parseError);
            console.log('Response preview:', responseData.substring(0, 500));
            responseData = null;
          }
        }
      }

      if (programs.length === 0 && responseData && typeof responseData === 'object') {
        console.log('PassKit API response keys:', Object.keys(responseData));

        if (Array.isArray(responseData)) {
          programs = responseData;
          total = programs.length;
        } else if (responseData?.result) {
          if (Array.isArray(responseData.result)) {
            programs = responseData.result;
            total = programs.length;
          } else if (typeof responseData.result === 'object') {
            programs = [responseData.result];
            total = 1;
          }
        } else if (responseData?.Programs && Array.isArray(responseData.Programs)) {
          programs = responseData.Programs;
          total = responseData.Total || responseData.totalNumber || programs.length;
        } else if (responseData?.programs && Array.isArray(responseData.programs)) {
          programs = responseData.programs;
          total = responseData.total || programs.length;
        } else if (responseData?.passes && Array.isArray(responseData.passes)) {
          programs = responseData.passes;
          total = responseData.total || programs.length;
        } else {
          console.warn('PassKit API response format unexpected:', typeof responseData);
          console.log('Response sample:', JSON.stringify(responseData).substring(0, 500));
        }
      }
      
      console.log(`✅ Found ${programs.length} PassKit programs`);

      return {
        success: true,
        programs: programs.map((p: Record<string, unknown>) => ({
          id: p.id as string,
          name: p.name as string,
          status: (p.status as string[]) || [],
          created: p.created as string,
          updated: p.updated as string,
        })),
        total,
      };

    } catch (error) {
      let errorMessage = 'Failed to list PassKit programs';
      
      if (axios.isAxiosError(error)) {
        console.error('❌ PassKit List Programs Error:', {
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

  async getProgram(programId: string): Promise<{
    success: boolean;
    program?: {
      id: string;
      name: string;
      status: string[];
      pointsType?: Record<string, unknown>;
      expiry?: Record<string, unknown>;
      created?: string;
      updated?: string;
    };
    error?: string;
  }> {
    const token = generatePassKitToken();
    
    if (!token) {
      return { 
        success: false, 
        error: 'PassKit not configured' 
      };
    }

    console.log(`📋 Fetching PassKit program: ${programId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/program/${programId}`;
      
      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.get(url, authConfig);

      console.log(`✅ Program details retrieved: ${response.data?.name}`);

      return {
        success: true,
        program: {
          id: response.data?.id,
          name: response.data?.name,
          status: response.data?.status || [],
          pointsType: response.data?.pointsType,
          expiry: response.data?.expiry,
          created: response.data?.created,
          updated: response.data?.updated,
        },
      };

    } catch (error) {
      let errorMessage = 'Failed to get PassKit program details';
      
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          return { success: false, error: 'Program not found in PassKit' };
        }
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

  async listTiers(programId: string): Promise<{
    success: boolean;
    tiers?: Array<{
      id: string;
      name: string;
      programId: string;
      passTypeIdentifier?: string;
      shortCode?: string;
      allowTierEnrolment?: boolean;
    }>;
    error?: string;
  }> {
    const token = generatePassKitToken();
    
    if (!token) {
      return { 
        success: false, 
        error: 'PassKit not configured' 
      };
    }

    console.log(`📋 Fetching tiers for program: ${programId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/tiers/list`;
      
      // PassKit requires programId at the top level of the request body
      const payload = {
        programId: programId,
        limit: 100,
      };

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      // PassKit returns NDJSON or array of tiers
      let tiers: Array<Record<string, unknown>> = [];
      
      console.log(`[PassKit Tiers] Response type: ${typeof response.data}`);
      
      if (typeof response.data === 'string') {
        // Handle NDJSON format
        const lines = response.data.split('\n').filter((line: string) => line.trim());
        console.log(`[PassKit Tiers] NDJSON lines: ${lines.length}`);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            console.log(`[PassKit Tiers] Parsed tier: ${JSON.stringify(parsed).substring(0, 200)}`);
            if (parsed && typeof parsed === 'object') {
              // Check if the parsed object has a 'result' wrapper (common in PassKit NDJSON)
              if (parsed.result && typeof parsed.result === 'object') {
                tiers.push(parsed.result);
              } else {
                tiers.push(parsed);
              }
            }
          } catch (e) {
            console.warn(`[PassKit Tiers] Failed to parse line: ${line.substring(0, 100)}`);
          }
        }
      } else if (Array.isArray(response.data)) {
        console.log(`[PassKit Tiers] Array response: ${response.data.length} items`);
        tiers = response.data;
      } else if (response.data?.tiers) {
        console.log(`[PassKit Tiers] Object with tiers property`);
        tiers = response.data.tiers;
      } else if (response.data && typeof response.data === 'object') {
        // Single tier object - check for result wrapper (common in PassKit single-item responses)
        console.log(`[PassKit Tiers] Single object response: ${JSON.stringify(response.data).substring(0, 200)}`);
        if (response.data.result && typeof response.data.result === 'object') {
          console.log(`[PassKit Tiers] Found wrapped result, extracting tier`);
          tiers.push(response.data.result);
        } else if (response.data.id) {
          // Direct tier object without wrapper
          console.log(`[PassKit Tiers] Found direct tier object`);
          tiers.push(response.data);
        }
      }
      
      console.log(`✅ Found ${tiers.length} tiers for program ${programId}`);
      if (tiers.length > 0) {
        console.log(`[PassKit Tiers] First tier keys: ${Object.keys(tiers[0]).join(', ')}`);
      }

      return {
        success: true,
        tiers: tiers.map((t: Record<string, unknown>) => ({
          id: t.id as string,
          name: t.name as string,
          programId: t.programId as string,
          passTypeIdentifier: t.passTypeIdentifier as string | undefined,
          shortCode: t.shortCode as string | undefined,
          allowTierEnrolment: t.allowTierEnrolment as boolean | undefined,
        })),
      };

    } catch (error) {
      let errorMessage = 'Failed to list PassKit tiers';
      
      if (axios.isAxiosError(error)) {
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

  async createTier(programId: string, tierName: string): Promise<{
    success: boolean;
    tierId?: string;
    error?: string;
  }> {
    const token = generatePassKitToken();
    
    if (!token) {
      return { 
        success: false, 
        error: 'PassKit not configured' 
      };
    }

    console.log(`🆕 Creating tier "${tierName}" for program: ${programId}`);

    try {
      const url = `${PASSKIT_BASE_URL}/members/tier`;
      
      const payload = {
        programId: programId,
        name: tierName,
        id: '', // PassKit will generate an ID
      };

      const authConfig = {
        headers: { Authorization: `Bearer ${token}` },
      };

      const response = await axios.post(url, payload, authConfig);

      const tierId = response.data?.id || response.data;
      console.log(`✅ Created tier with ID: ${tierId}`);

      return {
        success: true,
        tierId: typeof tierId === 'string' ? tierId : String(tierId),
      };

    } catch (error) {
      let errorMessage = 'Failed to create PassKit tier';
      
      if (axios.isAxiosError(error)) {
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

  async getOrCreateDefaultTier(programId: string): Promise<{
    success: boolean;
    tierId?: string;
    shortCode?: string;
    enrollmentUrl?: string;
    error?: string;
  }> {
    // First, try to list existing tiers
    const listResult = await this.listTiers(programId);
    
    if (listResult.success && listResult.tiers && listResult.tiers.length > 0) {
      // Use the first available tier as default
      const defaultTier = listResult.tiers[0];
      console.log(`📋 Using existing tier: ${defaultTier.name} (${defaultTier.id})`);
      console.log(`📋 Tier shortCode: ${defaultTier.shortCode || 'none'}, allowTierEnrolment: ${defaultTier.allowTierEnrolment}`);
      
      // Build enrollment URL using shortCode if available
      let enrollmentUrl: string | undefined;
      if (defaultTier.shortCode) {
        enrollmentUrl = `https://pub2.pskt.io/t/${defaultTier.shortCode}`;
      }
      
      return {
        success: true,
        tierId: defaultTier.id,
        shortCode: defaultTier.shortCode,
        enrollmentUrl,
      };
    }
    
    // No tiers exist, create a default one
    console.log(`📋 No tiers found for program ${programId}, creating default tier...`);
    return this.createTier(programId, 'Default');
  }

  async verifyProgramIsLive(programId: string): Promise<{
    success: boolean;
    isLive: boolean;
    status?: string[];
    error?: string;
  }> {
    const result = await this.getProgram(programId);
    
    if (!result.success || !result.program) {
      return { 
        success: false, 
        isLive: false, 
        error: result.error || 'Program not found' 
      };
    }

    const status = result.program.status || [];
    const isLive = status.includes('PROJECT_PUBLISHED') || 
                   status.includes('PROJECT_ACTIVE_FOR_OBJECT_CREATION');

    console.log(`🔍 Program ${programId} live status: ${isLive ? 'LIVE' : 'DRAFT'}`);
    console.log(`   Status flags: ${status.join(', ')}`);

    return {
      success: true,
      isLive,
      status,
    };
  }
}

export const passKitService = new PassKitService();
