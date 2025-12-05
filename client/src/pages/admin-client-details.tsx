import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Copy, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  User,
  Settings,
  CreditCard,
  Key,
  ExternalLink
} from "lucide-react";

const MOCK_PROFILES: Record<string, TenantProfile> = {
  "mock-user-001-aaaa-bbbb-cccc": {
    user: {
      id: "mock-user-001-aaaa-bbbb-cccc",
      email: "joe@joespizza.com",
      name: "Joe Carlucci",
      createdAt: "2024-11-15T10:30:00Z",
    },
    program: {
      id: "prog-001",
      name: "Joe's Pizza VIP Club",
      protocol: "MEMBERSHIP",
      dashboardSlug: "joes-pizza",
      enrollmentUrl: "https://pub1.pskt.io/c/joespizza",
      isSuspended: false,
      timezone: "America/New_York",
      earnRateMultiplier: 10,
      memberLimit: 500,
      postgridTemplateId: "template_pizza_001",
      passkit: {
        status: "provisioned",
        programId: "pk_pizza_vip_001",
        tierId: "tier_gold_001",
      },
    },
    billing: {
      activeMembers: 347,
      churnedMembers: 23,
      memberLimit: 500,
      usagePercent: 69,
      isOverLimit: false,
      lastSnapshotAt: "2024-12-04T06:00:00Z",
    },
    apiKeys: [
      {
        id: "key-001",
        keyPrefix: "pk_live_aBc",
        createdAt: "2024-11-15T10:30:00Z",
        lastUsedAt: "2024-12-05T14:22:00Z",
        isActive: true,
      },
      {
        id: "key-002",
        keyPrefix: "pk_test_xYz",
        createdAt: "2024-11-20T08:15:00Z",
        lastUsedAt: null,
        isActive: true,
      },
    ],
  },
  "mock-user-002-dddd-eeee-ffff": {
    user: {
      id: "mock-user-002-dddd-eeee-ffff",
      email: "maria@downtowndeli.com",
      name: "Maria Santos",
      createdAt: "2024-12-01T14:15:00Z",
    },
    program: {
      id: "prog-002",
      name: "Downtown Deli Rewards",
      protocol: "MEMBERSHIP",
      dashboardSlug: "downtown-deli",
      enrollmentUrl: "https://pub1.pskt.io/c/downtowndeli",
      isSuspended: false,
      timezone: "America/Chicago",
      earnRateMultiplier: 15,
      memberLimit: null,
      postgridTemplateId: null,
      passkit: {
        status: "provisioned",
        programId: "pk_deli_rewards_002",
        tierId: "tier_silver_002",
      },
    },
    billing: {
      activeMembers: 128,
      churnedMembers: 8,
      memberLimit: null,
      usagePercent: 0,
      isOverLimit: false,
      lastSnapshotAt: "2024-12-05T06:00:00Z",
    },
    apiKeys: [],
  },
  "mock-user-003-gggg-hhhh-iiii": {
    user: {
      id: "mock-user-003-gggg-hhhh-iiii",
      email: "events@summerfest.org",
      name: "Summer Music Festival",
      createdAt: "2024-10-20T09:00:00Z",
    },
    program: {
      id: "prog-003",
      name: "Summer Music Festival 2025",
      protocol: "EVENT_TICKET",
      dashboardSlug: "summer-fest-2025",
      enrollmentUrl: null,
      isSuspended: false,
      timezone: "America/Los_Angeles",
      earnRateMultiplier: 1,
      memberLimit: 5000,
      postgridTemplateId: "template_event_003",
      passkit: {
        status: "manual_required",
        programId: "pk_music_fest_003",
        tierId: null,
      },
    },
    billing: {
      activeMembers: 1250,
      churnedMembers: 0,
      memberLimit: 5000,
      usagePercent: 25,
      isOverLimit: false,
      lastSnapshotAt: "2024-12-04T06:00:00Z",
    },
    apiKeys: [
      {
        id: "key-003",
        keyPrefix: "pk_live_fEst",
        createdAt: "2024-10-20T09:00:00Z",
        lastUsedAt: "2024-12-01T18:45:00Z",
        isActive: true,
      },
    ],
  },
  "mock-user-004-jjjj-kkkk-llll": {
    user: {
      id: "mock-user-004-jjjj-kkkk-llll",
      email: "manager@harborcoffee.com",
      name: "Harbor Coffee House",
      createdAt: "2024-09-05T16:45:00Z",
    },
    program: {
      id: "prog-004",
      name: "Harbor Coffee House",
      protocol: "MEMBERSHIP",
      dashboardSlug: "harbor-coffee",
      enrollmentUrl: "https://pub1.pskt.io/c/harborcoffee",
      isSuspended: true,
      timezone: "America/New_York",
      earnRateMultiplier: 8,
      memberLimit: 200,
      postgridTemplateId: null,
      passkit: {
        status: "provisioned",
        programId: "pk_coffee_harbor_004",
        tierId: "tier_bronze_004",
      },
    },
    billing: {
      activeMembers: 89,
      churnedMembers: 156,
      memberLimit: 200,
      usagePercent: 45,
      isOverLimit: false,
      lastSnapshotAt: "2024-11-01T06:00:00Z",
    },
    apiKeys: [],
  },
  "mock-user-005-mmmm-nnnn-oooo": {
    user: {
      id: "mock-user-005-mmmm-nnnn-oooo",
      email: "promo@flashsale.com",
      name: "Flash Sale Marketing",
      createdAt: "2024-11-28T11:20:00Z",
    },
    program: {
      id: "prog-005",
      name: "Flash Sale 50% Off",
      protocol: "COUPON",
      dashboardSlug: "flash-sale-50",
      enrollmentUrl: "https://pub1.pskt.io/c/flashsale50",
      isSuspended: false,
      timezone: "America/New_York",
      earnRateMultiplier: 1,
      memberLimit: 10000,
      postgridTemplateId: "template_coupon_005",
      passkit: {
        status: "provisioned",
        programId: "pk_flash_sale_005",
        tierId: "tier_coupon_005",
      },
    },
    billing: {
      activeMembers: 2847,
      churnedMembers: 523,
      memberLimit: 10000,
      usagePercent: 28,
      isOverLimit: false,
      lastSnapshotAt: "2024-12-05T06:00:00Z",
    },
    apiKeys: [
      {
        id: "key-005",
        keyPrefix: "pk_live_SaLe",
        createdAt: "2024-11-28T11:20:00Z",
        lastUsedAt: "2024-12-05T09:15:00Z",
        isActive: true,
      },
    ],
  },
};

interface TenantProfile {
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
}

function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function fetchTenantProfile(userId: string): Promise<TenantProfile> {
  const token = getAuthToken();
  const response = await fetch(`/api/client/admin/tenants/${userId}/full-profile`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to fetch profile");
  }
  return result.data;
}

async function updateTenantConfig(programId: string, config: {
  earnRateMultiplier?: number;
  memberLimit?: number | null;
  postgridTemplateId?: string | null;
  isSuspended?: boolean;
}): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`/api/client/admin/tenants/${programId}/config`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(config),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to update configuration");
  }
}

async function retryPassKitSync(programId: string): Promise<{ enrollmentUrl?: string }> {
  const token = getAuthToken();
  const response = await fetch(`/api/client/admin/tenants/${programId}/retry-passkit`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "PassKit sync failed");
  }
  return result.data?.passkit || {};
}

export default function AdminClientDetailsPage() {
  const { userId } = useParams<{ userId: string }>();
  const { toast } = useToast();
  const { isAdmin, mockMode } = useAuth();
  
  const [configForm, setConfigForm] = useState({
    memberLimit: "",
    earnRateMultiplier: "",
    postgridTemplateId: "",
    isSuspended: false,
  });
  const [copied, setCopied] = useState(false);

  const { data: fetchedProfile, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-tenant-profile", userId],
    queryFn: () => fetchTenantProfile(userId!),
    enabled: isAdmin && !!userId && !mockMode,
  });

  const profile = useMemo(() => {
    if (mockMode && userId) {
      return MOCK_PROFILES[userId] || null;
    }
    return fetchedProfile;
  }, [mockMode, userId, fetchedProfile]);

  useEffect(() => {
    if (profile) {
      setConfigForm({
        memberLimit: profile.program.memberLimit?.toString() || "",
        earnRateMultiplier: profile.program.earnRateMultiplier.toString(),
        postgridTemplateId: profile.program.postgridTemplateId || "",
        isSuspended: profile.program.isSuspended,
      });
    }
  }, [profile]);

  const updateConfigMutation = useMutation({
    mutationFn: () => updateTenantConfig(profile!.program.id, {
      earnRateMultiplier: parseInt(configForm.earnRateMultiplier) || 10,
      memberLimit: configForm.memberLimit ? parseInt(configForm.memberLimit) : null,
      postgridTemplateId: configForm.postgridTemplateId || null,
      isSuspended: configForm.isSuspended,
    }),
    onSuccess: () => {
      toast({
        title: "Configuration Saved",
        description: "Program settings have been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-tenant-profile", userId] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncPassKitMutation = useMutation({
    mutationFn: () => retryPassKitSync(profile!.program.id),
    onSuccess: () => {
      toast({
        title: "PassKit Synced",
        description: "Digital wallet program has been provisioned successfully.",
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCopySlug = () => {
    if (profile?.program.dashboardSlug) {
      const url = `${window.location.origin}/enroll/${profile.program.dashboardSlug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "URL Copied",
        description: "Enrollment URL copied to clipboard.",
      });
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfigMutation.mutate();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md text-sm">
          You need administrator privileges to access this page.
        </p>
      </div>
    );
  }

  if (isLoading && !mockMode) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if ((error && !mockMode) || !profile) {
    return (
      <div className="space-y-6">
        <Link href="/admin/clients">
          <Button variant="ghost" size="sm" data-testid="button-back-to-clients">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Button>
        </Link>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <p className="text-destructive text-sm">{(error as Error)?.message || "Failed to load profile"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const passkitStatus = profile.program.passkit.status;
  const isPasskitSynced = passkitStatus === "provisioned";
  const canRetrySync = ["manual_required", "skipped"].includes(passkitStatus) && profile.program.protocol === "MEMBERSHIP";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin/clients">
            <Button variant="ghost" size="sm" data-testid="button-back-to-clients">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-client-name">
                {profile.program.name}
              </h1>
              {mockMode && (
                <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30" data-testid="badge-mock-mode">
                  Test Mode
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {mockMode ? "Viewing sample client data for testing" : "Client Command Center"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge 
            variant={profile.program.isSuspended ? "destructive" : "default"}
            data-testid="badge-status"
          >
            {profile.program.isSuspended ? "Suspended" : "Active"}
          </Badge>
          <Badge 
            variant={isPasskitSynced ? "default" : "secondary"}
            className={isPasskitSynced ? "bg-green-600" : "bg-amber-500"}
            data-testid="badge-passkit-status"
          >
            {isPasskitSynced ? "PassKit Synced" : "PassKit Pending"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card data-testid="card-identity">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5" />
              Identity & Status
            </CardTitle>
            <CardDescription>Owner information and enrollment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Owner</p>
              <p className="text-foreground mt-1">{profile.user.name}</p>
              <p className="text-sm text-muted-foreground">{profile.user.email}</p>
            </div>
            
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Dashboard Slug</p>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate" data-testid="text-dashboard-slug">
                  {profile.program.dashboardSlug}
                </code>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopySlug}
                  data-testid="button-copy-slug"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Protocol</p>
              <p className="text-foreground mt-1">{profile.program.protocol}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">PassKit Status</p>
              <div className="flex items-center gap-2 mt-1">
                {isPasskitSynced ? (
                  <Badge variant="outline" className="border-green-500 text-green-600">
                    <Check className="w-3 h-3 mr-1" />
                    Provisioned
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {passkitStatus === "manual_required" ? "Manual Required" : passkitStatus}
                  </Badge>
                )}
                {canRetrySync && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncPassKitMutation.mutate()}
                    disabled={syncPassKitMutation.isPending}
                    data-testid="button-retry-sync"
                  >
                    <RefreshCw className={`w-4 h-4 mr-1 ${syncPassKitMutation.isPending ? "animate-spin" : ""}`} />
                    {syncPassKitMutation.isPending ? "Syncing..." : "Retry Sync"}
                  </Button>
                )}
              </div>
            </div>

            {profile.program.enrollmentUrl && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Enrollment URL</p>
                <a 
                  href={profile.program.enrollmentUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                  data-testid="link-enrollment-url"
                >
                  Open PassKit Enrollment
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-configuration">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>Program settings and limits</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberLimit" className="text-sm">Member Limit</Label>
                <Input
                  id="memberLimit"
                  type="number"
                  placeholder="No limit"
                  value={configForm.memberLimit}
                  onChange={(e) => setConfigForm({ ...configForm, memberLimit: e.target.value })}
                  data-testid="input-member-limit"
                />
                <p className="text-xs text-muted-foreground">Maximum active members (leave empty for unlimited)</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="earnRateMultiplier" className="text-sm">Earn Rate Multiplier</Label>
                <Input
                  id="earnRateMultiplier"
                  type="number"
                  min="1"
                  max="1000"
                  value={configForm.earnRateMultiplier}
                  onChange={(e) => setConfigForm({ ...configForm, earnRateMultiplier: e.target.value })}
                  data-testid="input-earn-rate"
                />
                <p className="text-xs text-muted-foreground">Points per $1 spent (default: 10)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="postgridTemplateId" className="text-sm">PostGrid Template ID</Label>
                <Input
                  id="postgridTemplateId"
                  type="text"
                  placeholder="template_xxxxx"
                  value={configForm.postgridTemplateId}
                  onChange={(e) => setConfigForm({ ...configForm, postgridTemplateId: e.target.value })}
                  data-testid="input-postgrid-template"
                />
                <p className="text-xs text-muted-foreground">Default template for mail campaigns</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="space-y-1">
                  <Label htmlFor="isSuspended" className="text-sm">Suspend Program</Label>
                  <p className="text-xs text-muted-foreground">Block all transactions</p>
                </div>
                <Switch
                  id="isSuspended"
                  checked={configForm.isSuspended}
                  onCheckedChange={(checked) => setConfigForm({ ...configForm, isSuspended: checked })}
                  data-testid="switch-suspended"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full mt-4"
                disabled={updateConfigMutation.isPending}
                data-testid="button-save-config"
              >
                {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card data-testid="card-billing">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="w-5 h-5" />
              Billing Health
            </CardTitle>
            <CardDescription>Member usage and quotas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-muted-foreground">Active Members</p>
                <p className="text-lg font-semibold text-foreground" data-testid="text-active-members">
                  {profile.billing.activeMembers}
                  {profile.billing.memberLimit && (
                    <span className="text-muted-foreground font-normal"> / {profile.billing.memberLimit}</span>
                  )}
                </p>
              </div>
              {profile.billing.memberLimit && (
                <Progress 
                  value={Math.min(profile.billing.usagePercent, 100)} 
                  className={profile.billing.isOverLimit ? "[&>div]:bg-destructive" : ""}
                  data-testid="progress-usage"
                />
              )}
              {profile.billing.isOverLimit && (
                <div className="flex items-center gap-2 mt-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <p className="text-sm">Over member limit!</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Churned</p>
                <p className="text-lg font-semibold text-foreground mt-1" data-testid="text-churned-members">
                  {profile.billing.churnedMembers}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Usage</p>
                <p className="text-lg font-semibold text-foreground mt-1" data-testid="text-usage-percent">
                  {profile.billing.memberLimit ? `${profile.billing.usagePercent}%` : "N/A"}
                </p>
              </div>
            </div>

            {profile.billing.lastSnapshotAt && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Last snapshot: {new Date(profile.billing.lastSnapshotAt).toLocaleString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3" data-testid="card-api-keys">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Key className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription>POS integration keys for this program</CardDescription>
          </CardHeader>
          <CardContent>
            {profile.apiKeys.length > 0 ? (
              <div className="space-y-3">
                {profile.apiKeys.map((key) => (
                  <div 
                    key={key.id} 
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border"
                    data-testid={`api-key-${key.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.keyPrefix}...
                      </code>
                      <Badge variant={key.isActive ? "default" : "secondary"}>
                        {key.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {key.lastUsedAt ? (
                        <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                      ) : (
                        <span>Never used</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No API keys configured</p>
                <p className="text-xs mt-1">POS API keys will appear here when created</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
