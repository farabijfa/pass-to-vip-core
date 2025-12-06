import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { ChevronRight, AlertTriangle, Check, RefreshCw, Loader2 } from "lucide-react";

interface PassKitProgram {
  id: string;
  name: string;
  status: string[];
  created?: string;
  updated?: string | null;
}

const MOCK_TENANTS: Tenant[] = [
  {
    id: "mock-user-001-aaaa-bbbb-cccc",
    role: "CLIENT_ADMIN",
    created_at: "2024-11-15T10:30:00Z",
    programs: {
      id: "prog-001",
      name: "Joe's Pizza VIP Club",
      passkit_program_id: "pk_pizza_vip_001",
      passkit_status: "provisioned",
      protocol: "MEMBERSHIP",
      is_suspended: false,
      dashboard_slug: "joes-pizza",
      enrollment_url: "https://pub1.pskt.io/c/joespizza",
      earn_rate_multiplier: 10,
    },
  },
  {
    id: "mock-user-002-dddd-eeee-ffff",
    role: "CLIENT_ADMIN",
    created_at: "2024-12-01T14:15:00Z",
    programs: {
      id: "prog-002",
      name: "Downtown Deli Rewards",
      passkit_program_id: "pk_deli_rewards_002",
      passkit_status: "provisioned",
      protocol: "MEMBERSHIP",
      is_suspended: false,
      dashboard_slug: "downtown-deli",
      enrollment_url: "https://pub1.pskt.io/c/downtowndeli",
      earn_rate_multiplier: 15,
    },
  },
  {
    id: "mock-user-003-gggg-hhhh-iiii",
    role: "CLIENT_ADMIN",
    created_at: "2024-10-20T09:00:00Z",
    programs: {
      id: "prog-003",
      name: "Summer Music Festival 2025",
      passkit_program_id: "pk_music_fest_003",
      passkit_status: "manual_required",
      protocol: "EVENT_TICKET",
      is_suspended: false,
      dashboard_slug: "summer-fest-2025",
      enrollment_url: undefined,
      earn_rate_multiplier: 1,
    },
  },
  {
    id: "mock-user-004-jjjj-kkkk-llll",
    role: "CLIENT_ADMIN",
    created_at: "2024-09-05T16:45:00Z",
    programs: {
      id: "prog-004",
      name: "Harbor Coffee House",
      passkit_program_id: "pk_coffee_harbor_004",
      passkit_status: "provisioned",
      protocol: "MEMBERSHIP",
      is_suspended: true,
      dashboard_slug: "harbor-coffee",
      enrollment_url: "https://pub1.pskt.io/c/harborcoffee",
      earn_rate_multiplier: 8,
    },
  },
  {
    id: "mock-user-005-mmmm-nnnn-oooo",
    role: "CLIENT_ADMIN",
    created_at: "2024-11-28T11:20:00Z",
    programs: {
      id: "prog-005",
      name: "Flash Sale 50% Off",
      passkit_program_id: "pk_flash_sale_005",
      passkit_status: "provisioned",
      protocol: "COUPON",
      is_suspended: false,
      dashboard_slug: "flash-sale-50",
      enrollment_url: "https://pub1.pskt.io/c/flashsale50",
      earn_rate_multiplier: 1,
    },
  },
];

interface Tenant {
  id: string;
  role: string;
  created_at: string;
  programs: {
    id: string;
    name: string;
    passkit_program_id: string;
    passkit_status?: string;
    protocol: string;
    is_suspended: boolean;
    dashboard_slug?: string;
    enrollment_url?: string;
    earn_rate_multiplier?: number;
  } | null;
}

interface ProvisionRequest {
  businessName: string;
  email: string;
  password: string;
  passkitProgramId: string;
  protocol: "MEMBERSHIP" | "COUPON" | "EVENT_TICKET";
}

function getAuthToken(): string | null {
  return localStorage.getItem("auth_token");
}

async function fetchTenants(): Promise<{ tenants: Tenant[]; count: number }> {
  const token = getAuthToken();
  const response = await fetch("/api/client/admin/tenants", {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to fetch tenants");
  }
  return result.data;
}

async function provisionTenant(data: ProvisionRequest): Promise<{ userId: string; programId: string; email: string; businessName: string }> {
  const token = getAuthToken();
  const response = await fetch("/api/client/admin/provision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to provision tenant");
  }
  return result.data;
}

async function deleteTenant(userId: string): Promise<void> {
  const token = getAuthToken();
  const response = await fetch(`/api/client/admin/tenants/${userId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to delete tenant");
  }
}

async function fetchPassKitPrograms(): Promise<PassKitProgram[]> {
  const apiKey = localStorage.getItem("admin_api_key");
  if (!apiKey) {
    throw new Error("Admin API key not configured. Set it in Settings.");
  }
  const response = await fetch("/api/admin/passkit/programs?status=PROJECT_PUBLISHED", {
    headers: {
      "x-api-key": apiKey,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || "Failed to fetch PassKit programs");
  }
  return result.data?.programs || [];
}

export default function AdminClientsPage() {
  const { toast } = useToast();
  const { isAdmin, user, mockMode } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [formData, setFormData] = useState<ProvisionRequest>({
    businessName: "",
    email: "",
    password: "",
    passkitProgramId: "",
    protocol: "MEMBERSHIP",
  });

  const { 
    data: passkitPrograms, 
    isLoading: programsLoading, 
    error: programsError,
    refetch: refetchPrograms,
    isFetching: programsFetching
  } = useQuery({
    queryKey: ["admin-passkit-programs"],
    queryFn: fetchPassKitPrograms,
    enabled: isAdmin && isDialogOpen && !useManualEntry,
    staleTime: 30000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: fetchTenants,
    enabled: isAdmin && !mockMode,
  });

  const displayData = useMemo(() => {
    if (mockMode) {
      return { tenants: MOCK_TENANTS, count: MOCK_TENANTS.length };
    }
    return data;
  }, [mockMode, data]);

  const provisionMutation = useMutation({
    mutationFn: provisionTenant,
    onSuccess: (result) => {
      toast({
        title: "Client Created",
        description: `${result.businessName} has been provisioned successfully.`,
      });
      setIsDialogOpen(false);
      setFormData({
        businessName: "",
        email: "",
        password: "",
        passkitProgramId: "",
        protocol: "MEMBERSHIP",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => {
      toast({
        title: "Client Deleted",
        description: "The client has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.email || !formData.password || !formData.passkitProgramId) {
      toast({
        title: "Validation Error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }
    if (formData.password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters.",
        variant: "destructive",
      });
      return;
    }
    provisionMutation.mutate(formData);
  };

  const handleDelete = (userId: string, businessName: string) => {
    if (confirm(`Are you sure you want to delete "${businessName}"? This action cannot be undone.`)) {
      deleteMutation.mutate(userId);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md text-sm">
          You need administrator privileges to access this page. 
          Contact your platform administrator for access.
        </p>
        <span className="text-sm text-muted-foreground mt-2">
          Current Role: {user?.role || "Unknown"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-admin-clients-title">
              Client Management
            </h1>
            {mockMode && (
              <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30" data-testid="badge-mock-mode">
                Test Mode
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {mockMode ? "Viewing sample client data for testing" : "Provision and manage client accounts"}
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-client">
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Provision New Client</DialogTitle>
              <DialogDescription>
                Create a new client account with login credentials and program assignment.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-sm">Business Name</Label>
                <Input
                  id="businessName"
                  placeholder="Joe's Pizza"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  data-testid="input-business-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Login Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="owner@joespizza.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  data-testid="input-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 characters"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    data-testid="input-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="passkitProgramId" className="text-sm">PassKit Program</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => {
                      setUseManualEntry(!useManualEntry);
                      if (!useManualEntry) {
                        setFormData({ ...formData, passkitProgramId: "" });
                      }
                    }}
                    data-testid="button-toggle-manual-entry"
                  >
                    {useManualEntry ? "Select from list" : "Enter manually"}
                  </Button>
                </div>
                
                {useManualEntry ? (
                  <Input
                    id="passkitProgramId"
                    placeholder="Enter PassKit Program ID"
                    value={formData.passkitProgramId}
                    onChange={(e) => setFormData({ ...formData, passkitProgramId: e.target.value })}
                    data-testid="input-passkit-id-manual"
                  />
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={formData.passkitProgramId}
                      onValueChange={(value) => setFormData({ ...formData, passkitProgramId: value })}
                      disabled={programsLoading}
                    >
                      <SelectTrigger className="flex-1" data-testid="select-passkit-program">
                        <SelectValue placeholder={programsLoading ? "Loading programs..." : "Select a program"} />
                      </SelectTrigger>
                      <SelectContent>
                        {programsError ? (
                          <div className="p-2 text-sm text-destructive">
                            {(programsError as Error).message}
                          </div>
                        ) : passkitPrograms && passkitPrograms.length > 0 ? (
                          passkitPrograms.map((program) => (
                            <SelectItem key={program.id} value={program.id} data-testid={`option-program-${program.id}`}>
                              <div className="flex items-center gap-2">
                                <span>{program.name}</span>
                                {program.status?.includes("PROJECT_PUBLISHED") && (
                                  <Badge variant="default" className="bg-green-600 text-xs h-4">Live</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-sm text-muted-foreground">
                            No published programs found. Create one in PassKit first.
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => refetchPrograms()}
                      disabled={programsFetching}
                      data-testid="button-refresh-programs"
                    >
                      {programsFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
                
                {formData.passkitProgramId && !useManualEntry && (
                  <p className="text-xs text-muted-foreground">
                    ID: {formData.passkitProgramId}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol" className="text-sm">Protocol Type</Label>
                <Select
                  value={formData.protocol}
                  onValueChange={(value: "MEMBERSHIP" | "COUPON" | "EVENT_TICKET") => 
                    setFormData({ ...formData, protocol: value })
                  }
                >
                  <SelectTrigger data-testid="select-protocol">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MEMBERSHIP">Membership</SelectItem>
                    <SelectItem value="COUPON">Coupon</SelectItem>
                    <SelectItem value="EVENT_TICKET">Event Ticket</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setIsDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1"
                  disabled={provisionMutation.isPending}
                  data-testid="button-create-client"
                >
                  {provisionMutation.isPending ? "Creating..." : "Create Client"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && !mockMode ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <p className="text-destructive text-sm">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : isLoading && !mockMode ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 bg-muted" />
          ))}
        </div>
      ) : displayData?.tenants && displayData.tenants.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {displayData.count} client{displayData.count !== 1 ? "s" : ""} registered
          </p>
          <div className="grid gap-4">
            {displayData.tenants.map((tenant) => {
              const passkitStatus = tenant.programs?.passkit_status || "manual_required";
              const isPasskitSynced = passkitStatus === "provisioned";
              
              return (
                <Card key={tenant.id} className="border-border hover-elevate cursor-pointer" data-testid={`card-tenant-${tenant.id}`}>
                  <Link href={`/admin/clients/${tenant.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-foreground text-lg flex items-center gap-2">
                            {tenant.programs?.name || "Unknown Program"}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </CardTitle>
                          <CardDescription className="mt-1 text-sm">
                            User ID: {tenant.id.slice(0, 8)}...
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={tenant.programs?.is_suspended ? "destructive" : "default"}
                            data-testid={`badge-status-${tenant.id}`}
                          >
                            {tenant.programs?.is_suspended ? "Suspended" : "Active"}
                          </Badge>
                          <Badge 
                            variant={isPasskitSynced ? "default" : "secondary"}
                            className={isPasskitSynced ? "bg-green-600" : "bg-amber-500"}
                            data-testid={`badge-passkit-${tenant.id}`}
                          >
                            {isPasskitSynced ? (
                              <><Check className="w-3 h-3 mr-1" /> Synced</>
                            ) : (
                              <><AlertTriangle className="w-3 h-3 mr-1" /> Pending</>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </Link>
                  <CardContent className="space-y-4">
                    {tenant.programs?.dashboard_slug && (
                      <div className="p-3 bg-muted/30 rounded-md border border-border">
                        <p className="text-xs text-muted-foreground mb-1">Enrollment URL</p>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-foreground flex-1 truncate" data-testid={`text-enrollment-url-${tenant.id}`}>
                            {window.location.origin}/enroll/{tenant.programs.dashboard_slug}
                          </code>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const url = `${window.location.origin}/enroll/${tenant.programs?.dashboard_slug}`;
                              navigator.clipboard.writeText(url);
                              toast({
                                title: "URL Copied",
                                description: "Enrollment URL copied to clipboard.",
                              });
                            }}
                            data-testid={`button-copy-url-${tenant.id}`}
                          >
                            Copy
                          </Button>
                          <a
                            href={`/enroll/${tenant.programs.dashboard_slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`link-open-url-${tenant.id}`}
                          >
                            Open
                          </a>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Protocol</p>
                        <p className="text-foreground mt-1">{tenant.programs?.protocol || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Role</p>
                        <p className="text-foreground mt-1">{tenant.role}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Earn Rate</p>
                        <p className="text-foreground mt-1">{tenant.programs?.earn_rate_multiplier || 10}x</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
                        <p className="text-foreground mt-1">
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-end justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(tenant.id, tenant.programs?.name || "this client");
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid={`button-delete-${tenant.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">No Clients Yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Get started by provisioning your first client account.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-client">
              Add Your First Client
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
