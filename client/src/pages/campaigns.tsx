import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isMockMode } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

interface ClientProgram {
  id: string;
  name: string;
  passkit_program_id: string;
  protocol: string;
  userId?: string;
  passkit_status?: string;
  postgrid_template_id?: string;
  is_primary?: boolean;
}

interface Tenant {
  id: string;
  email: string;
  name: string;
  programs: ClientProgram[];
}

interface ClientProfile {
  user: {
    id: string;
    email: string;
    name: string;
  };
  program: {
    id: string;
    name: string;
    protocol: string;
    dashboardSlug: string;
    enrollmentUrl: string | null;
    isSuspended: boolean;
    earnRateMultiplier: number;
    memberLimit: number | null;
    postgridTemplateId: string | null;
    passkit: {
      status: string;
      programId: string | null;
      tierId: string | null;
    };
  };
}

interface ValidatedClient {
  id: string;
  name: string;
  programId: string;
  programName: string;
  passkitProgramId: string;
  protocol: string;
}

interface PostGridTemplate {
  id: string;
  name: string;
  description: string;
  type: "postcard" | "letter";
  createdAt?: string;
}

interface PreviewData {
  total: number;
  valid: number;
  invalid: number;
  missingFields: string[];
  sampleContacts: Array<{
    firstName: string;
    lastName: string;
    city: string;
    state: string;
    valid: boolean;
    issues?: string[];
  }>;
}

interface CampaignResult {
  summary: {
    total: number;
    success: number;
    failed: number;
    resourceType: string;
  };
  results: Array<{
    contact: string;
    success: boolean;
    claimCode?: string;
    mailId?: string;
    error?: string;
  }>;
}

interface CostEstimate {
  contactCount: number;
  resourceType: string;
  size: string;
  mailingClass: string;
  unitCostCents: number;
  totalCostCents: number;
  breakdown: {
    printing: number;
    postage: number;
    processing: number;
  };
}

interface CampaignHistory {
  id: string;
  program_id: string;
  name?: string;
  resource_type: string;
  size?: string;
  mailing_class?: string;
  status: string;
  total_contacts: number;
  success_count?: number;
  failed_count?: number;
  estimated_cost_cents?: number;
  created_at: string;
  completed_at?: string;
}

const POSTCARD_SIZES = [
  { value: "4x6", label: "4\" x 6\" (Standard)" },
  { value: "6x4", label: "6\" x 4\" (Standard)" },
  { value: "6x9", label: "6\" x 9\" (Large)" },
  { value: "9x6", label: "9\" x 6\" (Large)" },
  { value: "6x11", label: "6\" x 11\" (Jumbo)" },
  { value: "11x6", label: "11\" x 6\" (Jumbo)" },
];

const LETTER_SIZES = [
  { value: "us_letter", label: "US Letter (8.5\" x 11\")" },
  { value: "us_legal", label: "US Legal (8.5\" x 14\")" },
  { value: "a4", label: "A4 (210mm x 297mm)" },
];

const MAILING_CLASSES = [
  { value: "standard_class", label: "Standard Class (5-10 days)" },
  { value: "first_class", label: "First Class (3-5 days)" },
];

async function fetchClients(): Promise<{ tenants: Tenant[]; programs: ClientProgram[] }> {
  if (isMockMode()) {
    const tenants: Tenant[] = [
      {
        id: "mock-user-001",
        email: "pizza@example.com",
        name: "Pizza Palace Inc.",
        programs: [
          { id: "prog-1", name: "VIP Rewards Club", passkit_program_id: "pk_demo_1", protocol: "MEMBERSHIP", userId: "mock-user-001", passkit_status: "provisioned", postgrid_template_id: "tmpl_mock_1", is_primary: true },
          { id: "prog-1b", name: "Summer Concert Series", passkit_program_id: "pk_demo_1b", protocol: "EVENT_TICKET", userId: "mock-user-001", passkit_status: "provisioned", postgrid_template_id: undefined, is_primary: false },
        ],
      },
      {
        id: "mock-user-002",
        email: "coffee@example.com",
        name: "Java Joe's Coffee",
        programs: [
          { id: "prog-2", name: "Coffee Club VIP", passkit_program_id: "pk_demo_2", protocol: "MEMBERSHIP", userId: "mock-user-002", passkit_status: "manual_required", postgrid_template_id: undefined, is_primary: true },
        ],
      },
      {
        id: "mock-user-003",
        email: "stadium@example.com",
        name: "Metro Stadium",
        programs: [
          { id: "prog-3", name: "Stadium Events", passkit_program_id: "pk_demo_3", protocol: "EVENT_TICKET", userId: "mock-user-003", passkit_status: "skipped", postgrid_template_id: "tmpl_mock_2", is_primary: true },
          { id: "prog-3b", name: "Flash Sale Coupons", passkit_program_id: "pk_demo_3b", protocol: "COUPON", userId: "mock-user-003", passkit_status: "provisioned", postgrid_template_id: undefined, is_primary: false },
        ],
      },
    ];
    const programs = tenants.flatMap((t) => t.programs);
    return { tenants, programs };
  }

  const token = localStorage.getItem("auth_token");
  const response = await fetch("/api/client/admin/tenants", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!result.success) throw new Error(result.error?.message || "Failed to fetch clients");

  const rawTenants = result.data?.tenants || [];
  const tenantsMap = new Map<string, Tenant>();

  for (const t of rawTenants) {
    if (!t.programs || !t.programs.id) continue;

    if (!tenantsMap.has(t.id)) {
      tenantsMap.set(t.id, {
        id: t.id,
        email: t.email || "",
        name: t.name || t.email || "Unknown",
        programs: [],
      });
    }

    const tenant = tenantsMap.get(t.id)!;
    tenant.programs.push({
      id: t.programs.id,
      name: t.programs.name,
      passkit_program_id: t.programs.passkit_program_id || "",
      protocol: t.programs.protocol || "MEMBERSHIP",
      userId: t.id,
      passkit_status: t.programs.passkit_status || "manual_required",
      postgrid_template_id: t.programs.postgrid_template_id || undefined,
      is_primary: t.programs.is_primary ?? false,
    });
  }

  const tenants = Array.from(tenantsMap.values());
  const programs = tenants.flatMap((t) => t.programs);

  return { tenants, programs };
}

async function fetchTemplates(): Promise<{ templates: PostGridTemplate[] }> {
  if (isMockMode()) {
    return {
      templates: [
        { id: "tmpl_mock_1", name: "Holiday Special", description: "Holiday-themed postcard", type: "postcard" },
        { id: "tmpl_mock_2", name: "Welcome Mailer", description: "New member welcome", type: "postcard" },
        { id: "tmpl_mock_3", name: "VIP Letter", description: "Premium member letter", type: "letter" },
      ],
    };
  }
  const token = localStorage.getItem("auth_token");
  const response = await fetch("/api/campaign/templates", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!result.success) return { templates: [] };
  return { templates: result.data?.templates || [] };
}

async function fetchCampaignHistory(programId?: string): Promise<{ campaigns: CampaignHistory[]; total: number }> {
  if (isMockMode()) {
    return {
      campaigns: [
        { id: "camp-1", program_id: "prog-1", name: "Holiday Campaign", resource_type: "postcard", size: "6x4", status: "completed", total_contacts: 150, success_count: 145, failed_count: 5, estimated_cost_cents: 13350, created_at: new Date(Date.now() - 86400000 * 3).toISOString(), completed_at: new Date(Date.now() - 86400000 * 2).toISOString(), mailing_class: "first_class" },
        { id: "camp-2", program_id: "prog-2", name: "Summer Promo", resource_type: "postcard", size: "9x6", status: "processing", total_contacts: 75, estimated_cost_cents: 9675, created_at: new Date(Date.now() - 86400000).toISOString(), mailing_class: "standard_class" },
        { id: "camp-3", program_id: "prog-1", name: "VIP Letter", resource_type: "letter", size: "us_letter", status: "pending", total_contacts: 25, estimated_cost_cents: 3000, created_at: new Date().toISOString(), mailing_class: "first_class" },
      ],
      total: 3,
    };
  }
  const token = localStorage.getItem("auth_token");
  let url = "/api/campaign/history";
  if (programId) url += `?program_id=${programId}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!result.success) return { campaigns: [], total: 0 };
  return { campaigns: result.data?.campaigns || [], total: result.data?.total || 0 };
}

export default function CampaignsPage() {
  const { user, mockMode, isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<string>("launcher");
  const [clientMode, setClientMode] = useState<"dropdown" | "manual">("dropdown");
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [manualClientId, setManualClientId] = useState<string>("");
  const [validatedClient, setValidatedClient] = useState<ValidatedClient | null>(null);
  const [isValidatingClient, setIsValidatingClient] = useState(false);
  
  const [resourceType, setResourceType] = useState<"postcard" | "letter">("postcard");
  const [postcardSize, setPostcardSize] = useState<string>("6x4");
  const [letterSize, setLetterSize] = useState<string>("us_letter");
  const [mailingClass, setMailingClass] = useState<string>("standard_class");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedBackTemplate, setSelectedBackTemplate] = useState<string>("");
  const [templateAutoFilled, setTemplateAutoFilled] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [costEstimate, setCostEstimate] = useState<CostEstimate | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<CampaignResult | null>(null);

  const { data: clientsData, isLoading: isLoadingClients } = useQuery({
    queryKey: ["admin-clients-for-campaigns"],
    queryFn: fetchClients,
    enabled: isAdmin,
  });

  const { data: templatesData, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["campaign-templates"],
    queryFn: fetchTemplates,
    enabled: isAdmin,
  });

  const { data: historyData, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["campaign-history"],
    queryFn: () => fetchCampaignHistory(),
    enabled: isAdmin && activeTab === "history",
  });

  const selectedTenantData = clientsData?.tenants.find(t => t.id === selectedTenant);
  const tenantPrograms = selectedTenantData?.programs || [];
  const selectedProgram = tenantPrograms.find(p => p.id === selectedClient) || clientsData?.programs.find(p => p.id === selectedClient);
  const currentSize = resourceType === "postcard" ? postcardSize : letterSize;
  const filteredTemplates = templatesData?.templates.filter(t => t.type === resourceType) || [];

  const effectiveClient = clientMode === "dropdown" ? selectedProgram : validatedClient;

  useEffect(() => {
    if (selectedTenant && tenantPrograms.length > 0) {
      const primaryProgram = tenantPrograms.find(p => p.is_primary);
      if (primaryProgram) {
        setSelectedClient(primaryProgram.id);
      } else {
        setSelectedClient(tenantPrograms[0].id);
      }
    } else if (!selectedTenant) {
      setSelectedClient("");
    }
  }, [selectedTenant, tenantPrograms.length]);

  useEffect(() => {
    if (preview && preview.valid > 0) {
      fetchCostEstimate();
    }
  }, [preview?.valid, resourceType, currentSize, mailingClass]);

  useEffect(() => {
    if (clientMode === "dropdown" && selectedProgram) {
      if (selectedProgram.postgrid_template_id) {
        setSelectedTemplate(selectedProgram.postgrid_template_id);
        setTemplateAutoFilled(true);
      } else {
        setTemplateAutoFilled(false);
      }
    } else if (clientMode === "manual" && validatedClient) {
      setTemplateAutoFilled(false);
    } else {
      setTemplateAutoFilled(false);
    }
  }, [selectedProgram?.id, validatedClient?.id, clientMode]);

  const showPassKitWarning = 
    clientMode === "dropdown" && 
    selectedProgram && 
    selectedProgram.protocol === "MEMBERSHIP" && 
    selectedProgram.passkit_status !== "provisioned";

  const showTemplateTypeMismatch = 
    templateAutoFilled && 
    selectedTemplate && 
    filteredTemplates.length > 0 &&
    !filteredTemplates.some(t => t.id === selectedTemplate);

  const fetchCostEstimate = async () => {
    if (!preview || preview.valid === 0) return;

    if (isMockMode()) {
      const basePrices: Record<string, number> = {
        "4x6": 55, "6x4": 55, "6x9": 75, "9x6": 75, "6x11": 95, "11x6": 95,
        "us_letter": 120, "us_legal": 130, "a4": 120,
      };
      const multiplier = mailingClass === "first_class" ? 1.5 : 1.0;
      const unitCost = Math.round((basePrices[currentSize] || 75) * multiplier);
      setCostEstimate({
        contactCount: preview.valid,
        resourceType,
        size: currentSize,
        mailingClass,
        unitCostCents: unitCost,
        totalCostCents: unitCost * preview.valid,
        breakdown: { printing: 25, postage: Math.round(40 * multiplier), processing: 10 },
      });
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/campaign/estimate-cost", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          contact_count: preview.valid,
          resource_type: resourceType,
          size: currentSize,
          mailing_class: mailingClass,
        }),
      });
      const result = await response.json();
      if (result.success && result.data) {
        setCostEstimate(result.data);
      }
    } catch (error) {
      console.error("Cost estimation failed:", error);
    }
  };

  const handleValidateClient = async () => {
    if (!manualClientId.trim()) {
      toast({ title: "Missing Client ID", description: "Please enter a client ID to validate", variant: "destructive" });
      return;
    }

    setIsValidatingClient(true);
    setValidatedClient(null);

    try {
      if (isMockMode()) {
        await new Promise(r => setTimeout(r, 500));
        if (manualClientId.startsWith("test-")) {
          setValidatedClient({
            id: manualClientId,
            name: "Test Business",
            programId: "prog-test",
            programName: "Test Rewards Program",
            passkitProgramId: "pk_test_123",
            protocol: "MEMBERSHIP",
          });
          toast({ title: "Client Validated", description: "Client found and validated successfully" });
        } else {
          throw new Error("Client not found");
        }
        return;
      }

      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/campaign/validate-client", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clientId: manualClientId.trim() }),
      });
      const result = await response.json();

      if (result.success && result.data?.client) {
        setValidatedClient(result.data.client);
        toast({ title: "Client Validated", description: `Found: ${result.data.client.name}` });
      } else {
        throw new Error(result.error?.message || "Client not found");
      }
    } catch (error) {
      toast({
        title: "Validation Failed",
        description: error instanceof Error ? error.message : "Could not validate client",
        variant: "destructive",
      });
    } finally {
      setIsValidatingClient(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
          <LockIcon className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground mb-2">Access Denied</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Campaign Launcher is an admin-only feature. Please contact your administrator for access.
        </p>
      </div>
    );
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.toLowerCase().endsWith(".csv")) {
      handleFileSelect(droppedFile);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setPreview(null);
    setLaunchResult(null);
    setCostEstimate(null);
    setIsUploading(true);

    try {
      if (isMockMode()) {
        await new Promise(r => setTimeout(r, 800));
        const mockPreview: PreviewData = {
          total: 25,
          valid: 22,
          invalid: 3,
          missingFields: [],
          sampleContacts: [
            { firstName: "John", lastName: "Doe", city: "New York", state: "NY", valid: true },
            { firstName: "Jane", lastName: "Smith", city: "Los Angeles", state: "CA", valid: true },
            { firstName: "Mike", lastName: "Johnson", city: "Chicago", state: "IL", valid: true },
            { firstName: "Sarah", lastName: "Williams", city: "(missing)", state: "TX", valid: false, issues: ["city"] },
            { firstName: "David", lastName: "Brown", city: "Seattle", state: "WA", valid: true },
          ],
        };
        setPreview(mockPreview);
        toast({
          title: "CSV Parsed",
          description: `Found ${mockPreview.total} contacts (Mock Mode)`,
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", selectedFile);

      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/campaign/preview-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.data?.preview) {
        setPreview(result.data.preview);
        toast({
          title: "CSV Parsed",
          description: `Found ${result.data.preview.total} contacts`,
        });
      } else {
        throw new Error(result.error?.message || "Failed to parse CSV");
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to parse CSV",
        variant: "destructive",
      });
      setFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!file || !preview || !effectiveClient) return;

    setShowConfirmModal(false);
    setIsLaunching(true);

    try {
      if (isMockMode()) {
        await new Promise(r => setTimeout(r, 1500));
        const mockResult: CampaignResult = {
          summary: {
            total: preview.total,
            success: preview.valid,
            failed: preview.invalid,
            resourceType,
          },
          results: preview.sampleContacts.map((c, idx) => ({
            contact: `${c.firstName} ${c.lastName}`,
            success: c.valid,
            claimCode: c.valid ? `CLM-mock${idx}` : undefined,
            mailId: c.valid ? `mail_mock_${idx}` : undefined,
            error: !c.valid ? "Missing required fields" : undefined,
          })),
        };
        setLaunchResult(mockResult);
        toast({
          title: "Campaign Launched (Mock Mode)",
          description: `${mockResult.summary.success} ${resourceType}s simulated`,
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("program_id", clientMode === "dropdown" ? selectedClient : (validatedClient?.programId || ""));
      formData.append("resource_type", resourceType);
      formData.append("size", currentSize);
      formData.append("mailing_class", mailingClass);
      if (selectedTemplate) formData.append("front_template_id", selectedTemplate);
      if (selectedBackTemplate && resourceType === "postcard") formData.append("back_template_id", selectedBackTemplate);
      const clientName = clientMode === "dropdown" ? selectedProgram?.name : validatedClient?.programName;
      formData.append("description", `Campaign from ${file.name} for ${clientName}`);

      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/campaign/upload-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setLaunchResult(result.data);
        toast({
          title: "Campaign Launched",
          description: `${result.data.summary.success} ${resourceType}s queued for delivery`,
        });
        refetchHistory();
      } else {
        throw new Error(result.error?.message || "Campaign launch failed");
      }
    } catch (error) {
      toast({
        title: "Launch Failed",
        description: error instanceof Error ? error.message : "Campaign launch failed",
        variant: "destructive",
      });
    } finally {
      setIsLaunching(false);
    }
  };

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setLaunchResult(null);
    setCostEstimate(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "processing": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-campaigns-title">
            Campaign Launcher
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Send personalized postcards and letters to customers
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mockMode && (
            <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
          )}
          <Badge variant="secondary">Admin</Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="launcher" data-testid="tab-launcher">
            <RocketIcon className="w-4 h-4 mr-2" />
            Launch Campaign
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <HistoryIcon className="w-4 h-4 mr-2" />
            Campaign History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="launcher" className="space-y-6 mt-6">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base">Select Client</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Choose a client from the dropdown or enter a client ID manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={clientMode === "dropdown" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setClientMode("dropdown"); setValidatedClient(null); }}
                  data-testid="button-mode-dropdown"
                >
                  Select from List
                </Button>
                <Button
                  variant={clientMode === "manual" ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setClientMode("manual"); setSelectedTenant(""); setSelectedClient(""); }}
                  data-testid="button-mode-manual"
                >
                  Enter Client ID
                </Button>
              </div>

              {clientMode === "dropdown" ? (
                <>
                  {isLoadingClients ? (
                    <div className="space-y-3">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-foreground font-medium">Step 1: Select Client</Label>
                        <div className="flex gap-2">
                          <Select value={selectedTenant} onValueChange={(val) => { setSelectedTenant(val); setSelectedClient(""); }}>
                            <SelectTrigger className="flex-1" data-testid="select-tenant">
                              <SelectValue placeholder="Select a client (tenant)..." />
                            </SelectTrigger>
                            <SelectContent>
                              {clientsData?.tenants.map((tenant) => (
                                <SelectItem key={tenant.id} value={tenant.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{tenant.name}</span>
                                    <Badge variant="outline" className="text-xs ml-1">
                                      {tenant.programs.length} program{tenant.programs.length !== 1 ? "s" : ""}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedTenantData && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(`/admin/clients/${selectedTenantData.id}`, '_blank')}
                              title="View Client Settings"
                              data-testid="button-view-client"
                            >
                              <ExternalLinkIcon className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {selectedTenant && tenantPrograms.length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-sm text-foreground font-medium">Step 2: Select Target Program</Label>
                          <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger className="w-full" data-testid="select-program">
                              <SelectValue placeholder="Select a program..." />
                            </SelectTrigger>
                            <SelectContent>
                              {tenantPrograms.map((program) => (
                                <SelectItem key={program.id} value={program.id}>
                                  <div className="flex items-center gap-2">
                                    <span>{program.name}</span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        program.protocol === "MEMBERSHIP" ? "border-blue-500 text-blue-600" :
                                        program.protocol === "EVENT_TICKET" ? "border-purple-500 text-purple-600" :
                                        program.protocol === "COUPON" ? "border-orange-500 text-orange-600" :
                                        ""
                                      }`}
                                    >
                                      {program.protocol === "EVENT_TICKET" ? "EVENT" : program.protocol}
                                    </Badge>
                                    {program.is_primary && (
                                      <Badge variant="secondary" className="text-xs">Primary</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedProgram && (
                    <div className="p-3 rounded-md bg-muted/50 border border-border">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            selectedProgram.protocol === "MEMBERSHIP" ? "border-blue-500 text-blue-600" :
                            selectedProgram.protocol === "EVENT_TICKET" ? "border-purple-500 text-purple-600" :
                            selectedProgram.protocol === "COUPON" ? "border-orange-500 text-orange-600" :
                            ""
                          }`}
                        >
                          {selectedProgram.protocol === "EVENT_TICKET" ? "EVENT TICKET" : selectedProgram.protocol}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Program ID: {selectedProgram.id}
                        </span>
                        <span className="text-xs text-muted-foreground">|</span>
                        <span className="text-xs text-muted-foreground">
                          PassKit: {selectedProgram.passkit_program_id || "Not configured"}
                        </span>
                        {selectedProgram.passkit_status === "provisioned" && (
                          <Badge variant="outline" className="text-xs border-green-500 text-green-600">Synced</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {showPassKitWarning && (
                    <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-start gap-2" data-testid="alert-passkit-warning">
                      <AlertIcon className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-600">PassKit Not Synced</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          This client is not synced with PassKit. Campaigns may fail to generate digital passes.
                          <a 
                            href={`/admin/clients/${selectedProgram?.userId}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline ml-1"
                          >
                            Fix in Client Settings
                          </a>
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Enter client or tenant ID (e.g., uuid-xxx-yyy)"
                        value={manualClientId}
                        onChange={(e) => setManualClientId(e.target.value)}
                        data-testid="input-manual-client-id"
                      />
                    </div>
                    <Button
                      onClick={handleValidateClient}
                      disabled={isValidatingClient || !manualClientId.trim()}
                      data-testid="button-validate-client"
                    >
                      {isValidatingClient ? "Validating..." : "Validate"}
                    </Button>
                  </div>
                  {validatedClient && (
                    <div className="p-3 rounded-md bg-muted/50 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{validatedClient.name}</p>
                          <p className="text-xs text-muted-foreground">{validatedClient.programName}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{validatedClient.protocol}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {!effectiveClient && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <TargetIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Select or validate a client above to begin
              </p>
            </div>
          )}

          {effectiveClient && (launchResult ? (
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground text-lg flex items-center gap-2">
                  Campaign Complete
                  <Badge variant="default">{launchResult.summary.success} sent</Badge>
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Your {resourceType}s have been queued for delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-2xl font-semibold text-foreground">{launchResult.summary.total}</p>
                    <p className="text-xs text-muted-foreground mt-1">Total Contacts</p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-2xl font-semibold text-foreground">{launchResult.summary.success}</p>
                    <p className="text-xs text-muted-foreground mt-1">Sent Successfully</p>
                  </div>
                  <div className="p-4 rounded-md bg-muted/50">
                    <p className="text-2xl font-semibold text-muted-foreground">{launchResult.summary.failed}</p>
                    <p className="text-xs text-muted-foreground mt-1">Failed</p>
                  </div>
                </div>

                {launchResult.results.slice(0, 5).map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-md border border-border"
                    data-testid={`result-row-${idx}`}
                  >
                    <span className="text-sm text-foreground">{result.contact}</span>
                    {result.success ? (
                      <Badge variant="outline" className="text-xs">Sent</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">{result.error}</Badge>
                    )}
                  </div>
                ))}

                <Button onClick={resetState} className="w-full" data-testid="button-new-campaign">
                  Start New Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">Campaign Settings</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                      Configure your mail piece type and delivery options
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">Resource Type</Label>
                      <Select value={resourceType} onValueChange={(v) => setResourceType(v as "postcard" | "letter")}>
                        <SelectTrigger data-testid="select-resource-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="postcard">Postcard</SelectItem>
                          <SelectItem value="letter">Letter</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">Size</Label>
                      {resourceType === "postcard" ? (
                        <Select value={postcardSize} onValueChange={setPostcardSize}>
                          <SelectTrigger data-testid="select-postcard-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {POSTCARD_SIZES.map((size) => (
                              <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select value={letterSize} onValueChange={setLetterSize}>
                          <SelectTrigger data-testid="select-letter-size">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LETTER_SIZES.map((size) => (
                              <SelectItem key={size.value} value={size.value}>{size.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-foreground">Mailing Class</Label>
                      <Select value={mailingClass} onValueChange={setMailingClass}>
                        <SelectTrigger data-testid="select-mailing-class">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MAILING_CLASSES.map((mc) => (
                            <SelectItem key={mc.value} value={mc.value}>{mc.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {filteredTemplates.length > 0 && (
                      <>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Label className="text-sm text-foreground">
                              {resourceType === "postcard" ? "Front Template" : "Letter Template"}
                            </Label>
                            {templateAutoFilled && (
                              <Badge variant="outline" className="text-xs border-green-500 text-green-600" data-testid="badge-auto-filled">
                                Auto-filled from Client Settings
                              </Badge>
                            )}
                          </div>
                          <Select 
                            value={selectedTemplate} 
                            onValueChange={(v) => {
                              setSelectedTemplate(v);
                              setTemplateAutoFilled(false);
                            }}
                          >
                            <SelectTrigger data-testid="select-template">
                              <SelectValue placeholder="Select a template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {filteredTemplates.map((tmpl) => (
                                <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {showTemplateTypeMismatch && (
                            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs mt-1" data-testid="warning-template-mismatch">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Program default template is for a different resource type. Please select a valid {resourceType} template.</span>
                            </div>
                          )}
                        </div>
                        {resourceType === "postcard" && (
                          <div className="space-y-2">
                            <Label className="text-sm text-foreground">Back Template (Optional)</Label>
                            <Select 
                              value={selectedBackTemplate || "__none__"} 
                              onValueChange={(v) => setSelectedBackTemplate(v === "__none__" ? "" : v)}
                            >
                              <SelectTrigger data-testid="select-back-template">
                                <SelectValue placeholder="Same as front..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Same as front</SelectItem>
                                {filteredTemplates.map((tmpl) => (
                                  <SelectItem key={tmpl.id} value={tmpl.id}>{tmpl.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader>
                    <CardTitle className="text-foreground text-lg">Upload Customer List</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                      Drag and drop a CSV file with customer addresses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      data-testid="dropzone-csv"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileInputChange}
                        className="hidden"
                        data-testid="input-csv-file"
                      />

                      {isUploading ? (
                        <div className="space-y-4">
                          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          </div>
                          <p className="text-sm text-muted-foreground">Parsing CSV...</p>
                        </div>
                      ) : file ? (
                        <div className="space-y-2">
                          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                            <FileIcon className="w-6 h-6 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-foreground" data-testid="text-filename">
                            {file.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={resetState}
                            data-testid="button-remove-file"
                          >
                            Remove
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
                            <UploadIcon className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm text-foreground">
                              Drag and drop your CSV file here, or{" "}
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => fileInputRef.current?.click()}
                                data-testid="button-browse-files"
                              >
                                browse
                              </button>
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              CSV with columns: name, address, city, state, zip
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 p-4 rounded-md bg-muted/30">
                      <h4 className="text-sm font-medium text-foreground mb-2">Required CSV Columns</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span>first_name</span>
                        <span>last_name</span>
                        <span>address</span>
                        <span>city</span>
                        <span>state</span>
                        <span>zip</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-foreground text-lg">Campaign Preview</CardTitle>
                  <CardDescription className="text-muted-foreground text-sm">
                    Review before launching
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {preview ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-md bg-muted/50 text-center">
                          <p className="text-3xl font-semibold text-foreground" data-testid="text-valid-count">
                            {preview.valid}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Valid Addresses</p>
                        </div>
                        <div className="p-4 rounded-md bg-muted/50 text-center">
                          <p className="text-3xl font-semibold text-muted-foreground" data-testid="text-invalid-count">
                            {preview.invalid}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">Invalid/Incomplete</p>
                        </div>
                      </div>

                      {preview.invalid > 0 && (
                        <div className="p-3 rounded-md border border-destructive/50 bg-destructive/5">
                          <p className="text-sm text-destructive">
                            {preview.invalid} contact(s) missing required fields and will be skipped
                          </p>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-3">Sample Contacts</h4>
                        <div className="space-y-2">
                          {preview.sampleContacts.map((contact, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center justify-between p-2 rounded-md text-sm ${
                                contact.valid ? "bg-muted/30" : "bg-destructive/5"
                              }`}
                              data-testid={`sample-contact-${idx}`}
                            >
                              <span className="text-foreground">
                                {contact.firstName} {contact.lastName}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {contact.city}, {contact.state}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-4 space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Type</span>
                          <span className="text-foreground capitalize">{resourceType}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Size</span>
                          <span className="text-foreground">{currentSize}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Mailing Class</span>
                          <span className="text-foreground">{mailingClass === "first_class" ? "First Class" : "Standard"}</span>
                        </div>

                        {costEstimate && (
                          <>
                            <div className="border-t border-border pt-3 mt-3">
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Printing</span>
                                <span>{formatCurrency(costEstimate.breakdown.printing * costEstimate.contactCount)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                <span>Postage</span>
                                <span>{formatCurrency(costEstimate.breakdown.postage * costEstimate.contactCount)}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Processing</span>
                                <span>{formatCurrency(costEstimate.breakdown.processing * costEstimate.contactCount)}</span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-md bg-primary/5 border border-primary/20">
                              <span className="text-sm font-medium text-foreground">Estimated Total</span>
                              <span className="text-2xl font-semibold text-primary" data-testid="text-estimated-cost">
                                {formatCurrency(costEstimate.totalCostCents)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      <Button
                        className="w-full"
                        size="lg"
                        onClick={() => setShowConfirmModal(true)}
                        disabled={preview.valid === 0 || isLaunching}
                        data-testid="button-launch-campaign"
                      >
                        {isLaunching ? "Launching..." : `Launch Campaign (${preview.valid} ${resourceType}s)`}
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                        <MailIcon className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Upload a CSV file to see campaign preview
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Campaign History</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                View past campaigns and their delivery status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingHistory ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : historyData?.campaigns && historyData.campaigns.length > 0 ? (
                <div className="space-y-3">
                  {historyData.campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between p-4 rounded-md border border-border hover:bg-muted/30 transition-colors"
                      data-testid={`campaign-history-${campaign.id}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {campaign.name || `Campaign ${campaign.id.slice(0, 8)}`}
                          </p>
                          <Badge variant={getStatusBadgeVariant(campaign.status)} className="text-xs">
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                          <span className="capitalize">{campaign.resource_type}</span>
                          <span>{campaign.size}</span>
                          <span>{campaign.total_contacts} contacts</span>
                          <span>{new Date(campaign.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        {campaign.success_count !== undefined && (
                          <p className="text-sm font-medium text-foreground">
                            {campaign.success_count}/{campaign.total_contacts} sent
                          </p>
                        )}
                        {campaign.estimated_cost_cents && (
                          <p className="text-xs text-muted-foreground">
                            Est. {formatCurrency(campaign.estimated_cost_cents)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                    <HistoryIcon className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No campaigns have been launched yet
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Campaign Launch</DialogTitle>
            <DialogDescription>
              You are about to send {preview?.valid} {resourceType}s via {mailingClass === "first_class" ? "First Class" : "Standard"} mail.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Mail Pieces</span>
              <span className="text-sm font-medium text-foreground">{preview?.valid} {resourceType}s</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Delivery</span>
              <span className="text-sm font-medium text-foreground">
                {mailingClass === "first_class" ? "3-5 business days" : "5-10 business days"}
              </span>
            </div>
            {costEstimate && (
              <div className="flex items-center justify-between p-4 rounded-md bg-primary/5 border border-primary/20">
                <span className="text-sm font-medium text-foreground">Total Cost</span>
                <span className="text-xl font-semibold text-primary">{formatCurrency(costEstimate.totalCostCents)}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)} data-testid="button-cancel-launch">
              Cancel
            </Button>
            <Button onClick={handleLaunchCampaign} data-testid="button-confirm-launch">
              Confirm & Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
