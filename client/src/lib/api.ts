const MOCK_MODE = import.meta.env.VITE_MOCK_MODE === "true";
const API_BASE = import.meta.env.VITE_API_BASE || "";

export interface ClientContext {
  userId: string;
  role: string;
  programId: string;
  programName: string;
  passkitProgramId: string;
  passkitTierId: string | null;
  protocol: string;
  isSuspended: boolean;
  birthdayMessage: string | null;
  enrollmentUrl: string | null;
  dashboardSlug: string | null;
  createdAt: string;
}

export interface AnalyticsData {
  programId: string;
  totals: {
    total: number;
    active: number;
    churned: number;
  };
  bySource: Record<string, { total: number; active: number; churned: number }>;
  sources: {
    csv: { total: number; active: number; churned: number };
    smartpass: { total: number; active: number; churned: number };
    claimCode: { total: number; active: number; churned: number };
  };
}

export interface Member {
  id: string;
  external_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  points_balance: number;
  tier_name: string;
  status: string;
  enrollment_source: string;
  earn_rate_multiplier: number;
  program_id?: string;
  program_name?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  recipientCount: number;
  successCount: number;
  failedCount: number;
  message: string | null;
  targetSegment: string;
  createdAt: string;
  successRate: number;
}

export interface POSResponse {
  success: boolean;
  action: string;
  memberId: string;
  previousBalance: number;
  newBalance: number;
  transactionId: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  metadata?: {
    processingTime: number;
  };
}

const mockClientContext: ClientContext = {
  userId: "mock-user-123",
  role: "CLIENT_ADMIN",
  programId: "mock-program-456",
  programName: "Demo Pizza Rewards",
  passkitProgramId: "pk_demo_123",
  passkitTierId: "tier_gold",
  protocol: "MEMBERSHIP",
  isSuspended: false,
  birthdayMessage: "Happy Birthday! Enjoy 2x points today!",
  enrollmentUrl: "https://passtovip.com/enroll/demo-pizza",
  dashboardSlug: "demo-pizza",
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};

const mockAnalytics: AnalyticsData = {
  programId: "mock-program-456",
  totals: { total: 1247, active: 892, churned: 355 },
  bySource: {
    CSV: { total: 450, active: 312, churned: 138 },
    SMARTPASS: { total: 523, active: 412, churned: 111 },
    CLAIM_CODE: { total: 274, active: 168, churned: 106 },
  },
  sources: {
    csv: { total: 450, active: 312, churned: 138 },
    smartpass: { total: 523, active: 412, churned: 111 },
    claimCode: { total: 274, active: 168, churned: 106 },
  },
};

const mockMembers: Member[] = [
  { id: "m1", external_id: "PUB-abc123", first_name: "John", last_name: "Doe", email: "john@example.com", phone: "+1555123456", points_balance: 1250, tier_name: "Gold", status: "INSTALLED", enrollment_source: "SMARTPASS", earn_rate_multiplier: 10, created_at: "2024-10-15T10:30:00Z" },
  { id: "m2", external_id: "CLM-def456", first_name: "Jane", last_name: "Smith", email: "jane@example.com", phone: "+1555789012", points_balance: 500, tier_name: "Silver", status: "INSTALLED", enrollment_source: "CLAIM_CODE", earn_rate_multiplier: 100, created_at: "2024-11-02T14:20:00Z" },
  { id: "m3", external_id: "PUB-ghi789", first_name: "Mike", last_name: "Johnson", email: "mike@example.com", phone: null, points_balance: 100, tier_name: "Bronze", status: "INSTALLED", enrollment_source: "CSV", earn_rate_multiplier: 10, created_at: "2024-09-20T09:15:00Z" },
  { id: "m4", external_id: "PUB-jkl012", first_name: "Sarah", last_name: "Williams", email: "sarah@example.com", phone: "+1555345678", points_balance: 450, tier_name: "Bronze", status: "UNINSTALLED", enrollment_source: "SMARTPASS", earn_rate_multiplier: 10, created_at: "2024-08-10T16:45:00Z" },
  { id: "m5", external_id: "CLM-mno345", first_name: "David", last_name: "Brown", email: "david@example.com", phone: "+1555901234", points_balance: 3200, tier_name: "Platinum", status: "INSTALLED", enrollment_source: "CLAIM_CODE", earn_rate_multiplier: 1, created_at: "2024-07-05T11:00:00Z" },
];

function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("auth_token");
}

export function isAuthenticated(): boolean {
  return MOCK_MODE || !!getToken();
}

export function isMockMode(): boolean {
  return MOCK_MODE;
}

async function apiCall<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const token = getToken();
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  return response.json();
}

const mockCampaigns: Campaign[] = [
  { id: "c1", name: "Holiday Points Bonus", recipientCount: 523, successCount: 498, failedCount: 25, message: "Happy Holidays! Earn 2x points this week.", targetSegment: "All Members", createdAt: "2024-12-01T10:00:00Z", successRate: 95 },
  { id: "c2", name: "Birthday Rewards", recipientCount: 47, successCount: 47, failedCount: 0, message: "Happy Birthday! Enjoy bonus points.", targetSegment: "Birthday Members", createdAt: "2024-11-28T09:00:00Z", successRate: 100 },
  { id: "c3", name: "Win-Back Campaign", recipientCount: 156, successCount: 142, failedCount: 14, message: "We miss you! Come back for 50 bonus points.", targetSegment: "Inactive 30+ Days", createdAt: "2024-11-15T14:30:00Z", successRate: 91 },
];

export const clientApi = {
  async getMe(): Promise<ApiResponse<ClientContext>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 300));
      return { success: true, data: mockClientContext };
    }
    return apiCall<ClientContext>("/api/client/me");
  },

  async getAnalytics(): Promise<ApiResponse<AnalyticsData>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 500));
      return { success: true, data: mockAnalytics };
    }
    return apiCall<AnalyticsData>("/api/client/analytics");
  },

  async getCampaigns(limit = 10): Promise<ApiResponse<{ campaigns: Campaign[]; count: number }>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 400));
      return { success: true, data: { campaigns: mockCampaigns, count: mockCampaigns.length } };
    }
    return apiCall<{ campaigns: Campaign[]; count: number }>(`/api/client/campaigns?limit=${limit}`);
  },
};

export const memberApi = {
  async search(query: string): Promise<ApiResponse<{ members: Member[]; count: number }>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 400));
      const filtered = mockMembers.filter(m => 
        m.first_name.toLowerCase().includes(query.toLowerCase()) ||
        m.last_name.toLowerCase().includes(query.toLowerCase()) ||
        m.email.toLowerCase().includes(query.toLowerCase()) ||
        m.external_id.toLowerCase().includes(query.toLowerCase())
      );
      return { success: true, data: { members: filtered, count: filtered.length } };
    }
    return apiCall<{ members: Member[]; count: number }>(`/api/client/members?q=${encodeURIComponent(query)}`);
  },

  async getById(externalId: string): Promise<ApiResponse<Member>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 300));
      const member = mockMembers.find(m => m.external_id === externalId);
      if (member) {
        return { success: true, data: member };
      }
      return { success: false, error: { code: "NOT_FOUND", message: "Member not found" } };
    }
    return apiCall<{ members: Member[]; count: number }>(`/api/client/members?q=${encodeURIComponent(externalId)}`).then(res => {
      if (res.success && res.data && res.data.members && res.data.members.length > 0) {
        return { success: true, data: res.data.members[0] };
      }
      return { success: false, error: { code: "NOT_FOUND", message: "Member not found" } };
    });
  },

  async getAll(): Promise<ApiResponse<{ members: Member[]; count: number }>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 400));
      return { success: true, data: { members: mockMembers, count: mockMembers.length } };
    }
    return apiCall<{ members: Member[]; count: number }>("/api/client/members");
  },
};

export const posApi = {
  async earn(externalId: string, points?: number, transactionAmount?: number): Promise<ApiResponse<POSResponse>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 600));
      const member = mockMembers.find(m => m.external_id === externalId);
      if (!member) {
        return { success: false, error: { code: "NOT_FOUND", message: "Member not found" } };
      }
      const prevBalance = member.points_balance;
      const earnedPoints = transactionAmount !== undefined 
        ? Math.floor(transactionAmount * member.earn_rate_multiplier)
        : (points || 0);
      member.points_balance += earnedPoints;
      return {
        success: true,
        data: {
          success: true,
          action: "EARN",
          memberId: externalId,
          previousBalance: prevBalance,
          newBalance: member.points_balance,
          transactionId: `txn_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
    const body: Record<string, unknown> = { externalId };
    if (transactionAmount !== undefined) {
      body.transactionAmount = transactionAmount;
    } else if (points !== undefined) {
      body.points = points;
    }
    return apiCall<POSResponse>("/api/pos/earn", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async redeem(externalId: string, points: number): Promise<ApiResponse<POSResponse>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 600));
      const member = mockMembers.find(m => m.external_id === externalId);
      if (!member) {
        return { success: false, error: { code: "NOT_FOUND", message: "Member not found" } };
      }
      if (member.points_balance < points) {
        return { success: false, error: { code: "INSUFFICIENT_BALANCE", message: "Not enough points" } };
      }
      const prevBalance = member.points_balance;
      member.points_balance -= points;
      return {
        success: true,
        data: {
          success: true,
          action: "REDEEM",
          memberId: externalId,
          previousBalance: prevBalance,
          newBalance: member.points_balance,
          transactionId: `txn_${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      };
    }
    return apiCall<POSResponse>("/api/pos/redeem", {
      method: "POST",
      body: JSON.stringify({ externalId, points }),
    });
  },

  async lookup(externalId: string): Promise<ApiResponse<{ member: Member; balance: number }>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 300));
      const member = mockMembers.find(m => m.external_id === externalId);
      if (!member) {
        return { success: false, error: { code: "NOT_FOUND", message: "Member not found" } };
      }
      return { success: true, data: { member, balance: member.points_balance } };
    }
    const result = await apiCall<{ member: Member }>("/api/pos/lookup", {
      method: "POST",
      body: JSON.stringify({ externalId }),
    });
    if (result.success && result.data?.member) {
      return { 
        success: true, 
        data: { 
          member: result.data.member, 
          balance: result.data.member.points_balance 
        } 
      };
    }
    return { success: false, error: result.error || { code: "NOT_FOUND", message: "Member not found" } };
  },
};

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: { id: string; email: string } }>> {
    if (MOCK_MODE) {
      await new Promise(r => setTimeout(r, 500));
      if (email && password) {
        const mockToken = "mock_jwt_token_" + Date.now();
        setToken(mockToken);
        return {
          success: true,
          data: {
            token: mockToken,
            user: { id: "mock-user-123", email },
          },
        };
      }
      return { success: false, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } };
    }
    
    const response = await fetch(`${API_BASE}/api/client/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    
    const result = await response.json();
    
    if (result.success && result.data?.token) {
      setToken(result.data.token);
    }
    
    return result;
  },

  async logout(): Promise<void> {
    clearToken();
  },
};
