import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { 
  Users, 
  Plus, 
  Building2, 
  Mail, 
  Key, 
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Eye,
  EyeOff,
  ShieldAlert
} from "lucide-react";

interface Tenant {
  id: string;
  role: string;
  created_at: string;
  programs: {
    id: string;
    name: string;
    passkit_program_id: string;
    protocol: string;
    is_suspended: boolean;
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

export default function AdminClientsPage() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<ProvisionRequest>({
    businessName: "",
    email: "",
    password: "",
    passkitProgramId: "",
    protocol: "MEMBERSHIP",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: fetchTenants,
    enabled: isAdmin,
  });

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
        <ShieldAlert className="h-16 w-16 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold text-foreground">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          You need administrator privileges to access this page. 
          Contact your platform administrator for access.
        </p>
        <Badge variant="outline" className="mt-2">
          Current Role: {user?.role || "Unknown"}
        </Badge>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-admin-clients-title">
            Client Management
          </h1>
          <p className="text-muted-foreground">
            Provision and manage client accounts
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-client">
              <Plus className="h-4 w-4 mr-2" />
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
                <Label htmlFor="businessName" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Business Name
                </Label>
                <Input
                  id="businessName"
                  placeholder="Joe's Pizza"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  data-testid="input-business-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Login Email
                </Label>
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
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Password
                </Label>
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
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="passkitProgramId">PassKit Program ID</Label>
                <Input
                  id="passkitProgramId"
                  placeholder="pk_xxxxxxxx"
                  value={formData.passkitProgramId}
                  onChange={(e) => setFormData({ ...formData, passkitProgramId: e.target.value })}
                  data-testid="input-passkit-id"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="protocol">Protocol Type</Label>
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
                  {provisionMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Client"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error ? (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive">{(error as Error).message}</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 bg-muted" />
          ))}
        </div>
      ) : data?.tenants && data.tenants.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>{data.count} client{data.count !== 1 ? "s" : ""} registered</span>
          </div>
          <div className="grid gap-4">
            {data.tenants.map((tenant) => (
              <Card key={tenant.id} className="border-border bg-card/80" data-testid={`card-tenant-${tenant.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-foreground flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {tenant.programs?.name || "Unknown Program"}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        User ID: {tenant.id.slice(0, 8)}...
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={tenant.programs?.is_suspended ? "destructive" : "default"}
                        data-testid={`badge-status-${tenant.id}`}
                      >
                        {tenant.programs?.is_suspended ? (
                          <>
                            <XCircle className="h-3 w-3 mr-1" />
                            Suspended
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        )}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(tenant.id, tenant.programs?.name || "this client")}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${tenant.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Protocol</p>
                      <Badge variant="outline" className="mt-1">
                        {tenant.programs?.protocol || "N/A"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Role</p>
                      <p className="text-foreground font-medium mt-1">{tenant.role}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">PassKit ID</p>
                      <code className="text-xs text-muted-foreground block mt-1 truncate">
                        {tenant.programs?.passkit_program_id || "N/A"}
                      </code>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Created</p>
                      <p className="text-foreground mt-1">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-border bg-card/80">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Clients Yet</h3>
            <p className="text-muted-foreground mb-4">
              Get started by provisioning your first client account.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first-client">
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Client
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
