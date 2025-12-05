import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bell,
  Send,
  Users,
  Crown,
  Clock,
  MapPin,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Upload,
  History,
  Sparkles,
  Medal,
  Award,
  Star,
  Gem,
  Ticket,
  TicketCheck,
  UserX,
  UserCheck,
  Shield,
  Building,
} from "lucide-react";

type ProtocolType = "MEMBERSHIP" | "COUPON" | "EVENT_TICKET";
type SegmentType = string;

interface SegmentInfo {
  type: SegmentType;
  name: string;
  description: string;
  icon: string;
  estimatedCount?: number;
  requiresConfig?: boolean;
  configType?: string;
}

interface SegmentPreview {
  segment: SegmentType;
  description: string;
  count: number;
  protocol: ProtocolType;
  sampleMembers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    pointsBalance?: number;
    tierPoints?: number;
    lastUpdated?: string;
    zipCode?: string;
  }>;
}

interface TierThresholds {
  bronze: number;
  silver: number;
  gold: number;
}

interface CampaignLog {
  id: string;
  program_id: string;
  campaign_name: string;
  recipient_count: number;
  success_count: number;
  failed_count: number;
  message_content: string;
  target_segment: string;
  created_at: string;
  programs?: {
    name: string;
    passkit_program_id: string;
    protocol?: string;
  };
}

interface Tenant {
  id: string;
  name: string;
  programs: Array<{
    id: string;
    name: string;
    protocol: ProtocolType;
    passkit_program_id: string;
    is_primary: boolean;
  }>;
}

const iconComponents: Record<string, typeof Users> = {
  Users,
  Medal,
  Award,
  Star,
  Crown,
  Gem,
  Clock,
  MapPin,
  Building,
  FileSpreadsheet,
  Ticket,
  TicketCheck,
  AlertTriangle,
  UserX,
  UserCheck,
};

const mockTenants: Tenant[] = [
  {
    id: "demo-tenant-001",
    name: "Demo Coffee Shop",
    programs: [
      {
        id: "demo-program-001",
        name: "Coffee Rewards",
        protocol: "MEMBERSHIP",
        passkit_program_id: "pk-demo-001",
        is_primary: true,
      },
      {
        id: "demo-program-002",
        name: "Holiday Coupon",
        protocol: "COUPON",
        passkit_program_id: "pk-demo-002",
        is_primary: false,
      },
    ],
  },
  {
    id: "demo-tenant-002",
    name: "Demo Event Venue",
    programs: [
      {
        id: "demo-program-003",
        name: "Concert Tickets 2025",
        protocol: "EVENT_TICKET",
        passkit_program_id: "pk-demo-003",
        is_primary: true,
      },
    ],
  },
];

const mockMembershipSegments: SegmentInfo[] = [
  { type: "ALL", name: "All Members", description: "All active members", icon: "Users", estimatedCount: 1234 },
  { type: "TIER_1", name: "Bronze Tier", description: "0-999 points", icon: "Medal", estimatedCount: 456 },
  { type: "TIER_2", name: "Silver Tier", description: "1000-4999 points", icon: "Award", estimatedCount: 321 },
  { type: "TIER_3", name: "Gold Tier", description: "5000-14999 points", icon: "Star", estimatedCount: 89 },
  { type: "TIER_4", name: "Platinum Tier", description: "15000+ points", icon: "Crown", estimatedCount: 23 },
  { type: "VIP", name: "VIP", description: "Custom threshold", icon: "Gem", requiresConfig: true, configType: "vip" },
  { type: "DORMANT", name: "Dormant", description: "Inactive members", icon: "Clock", requiresConfig: true, configType: "dormant" },
  { type: "GEO", name: "Geographic (ZIP)", description: "By ZIP code", icon: "MapPin", requiresConfig: true, configType: "geo" },
  { type: "CITY", name: "City", description: "By city name", icon: "Building", requiresConfig: true, configType: "cities" },
  { type: "CSV", name: "CSV Upload", description: "Custom list", icon: "FileSpreadsheet", requiresConfig: true, configType: "csv" },
];

const mockCouponSegments: SegmentInfo[] = [
  { type: "ALL_ACTIVE", name: "All Active", description: "All active coupons", icon: "Ticket", estimatedCount: 567 },
  { type: "UNREDEEMED", name: "Unredeemed", description: "Not yet used", icon: "TicketCheck", estimatedCount: 234 },
  { type: "EXPIRING_SOON", name: "Expiring Soon", description: "Expires within 7 days", icon: "AlertTriangle", estimatedCount: 45 },
  { type: "GEO", name: "Geographic (ZIP)", description: "By ZIP code", icon: "MapPin", requiresConfig: true, configType: "geo" },
  { type: "CITY", name: "City", description: "By city name", icon: "Building", requiresConfig: true, configType: "cities" },
  { type: "CSV", name: "CSV Upload", description: "Custom list", icon: "FileSpreadsheet", requiresConfig: true, configType: "csv" },
];

const mockEventSegments: SegmentInfo[] = [
  { type: "ALL_TICKETED", name: "All Ticketed", description: "All ticket holders", icon: "Ticket", estimatedCount: 890 },
  { type: "NOT_CHECKED_IN", name: "Not Checked In", description: "Haven't arrived", icon: "UserX", estimatedCount: 456 },
  { type: "CHECKED_IN", name: "Checked In", description: "Already arrived", icon: "UserCheck", estimatedCount: 434 },
  { type: "GEO", name: "Geographic (ZIP)", description: "By ZIP code", icon: "MapPin", requiresConfig: true, configType: "geo" },
  { type: "CITY", name: "City", description: "By city name", icon: "Building", requiresConfig: true, configType: "cities" },
  { type: "CSV", name: "CSV Upload", description: "Custom list", icon: "FileSpreadsheet", requiresConfig: true, configType: "csv" },
];

const mockTierThresholds: TierThresholds = {
  bronze: 999,
  silver: 4999,
  gold: 14999,
};

const mockLogs: CampaignLog[] = [
  {
    id: "log-001",
    program_id: "demo-program-001",
    campaign_name: "Welcome Bonus",
    recipient_count: 150,
    success_count: 148,
    failed_count: 2,
    message_content: "Welcome! Earn double points this week.",
    target_segment: "ALL",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    programs: { name: "Coffee Rewards", passkit_program_id: "pk-demo-001", protocol: "MEMBERSHIP" },
  },
  {
    id: "log-002",
    program_id: "demo-program-001",
    campaign_name: "Gold Member Exclusive",
    recipient_count: 45,
    success_count: 45,
    failed_count: 0,
    message_content: "Exclusive: 3x points this weekend!",
    target_segment: "TIER_GOLD",
    created_at: new Date(Date.now() - 172800000).toISOString(),
    programs: { name: "Coffee Rewards", passkit_program_id: "pk-demo-001", protocol: "MEMBERSHIP" },
  },
];

const protocolColors: Record<ProtocolType, string> = {
  MEMBERSHIP: "bg-blue-500/20 text-blue-500 border-blue-500/30",
  COUPON: "bg-green-500/20 text-green-500 border-green-500/30",
  EVENT_TICKET: "bg-purple-500/20 text-purple-500 border-purple-500/30",
};

const protocolIcons: Record<ProtocolType, typeof Shield> = {
  MEMBERSHIP: Users,
  COUPON: Ticket,
  EVENT_TICKET: TicketCheck,
};

function getSegmentColor(segment: string): string {
  const colorMap: Record<string, string> = {
    ALL: "bg-primary/20 text-primary",
    TIER_1: "bg-amber-600/20 text-amber-600",
    TIER_2: "bg-slate-400/20 text-slate-400",
    TIER_3: "bg-yellow-500/20 text-yellow-500",
    TIER_4: "bg-cyan-400/20 text-cyan-400",
    VIP: "bg-yellow-500/20 text-yellow-500",
    DORMANT: "bg-orange-500/20 text-orange-500",
    GEO: "bg-green-500/20 text-green-500",
    CITY: "bg-teal-500/20 text-teal-500",
    CSV: "bg-purple-500/20 text-purple-500",
    ALL_ACTIVE: "bg-primary/20 text-primary",
    UNREDEEMED: "bg-blue-500/20 text-blue-500",
    EXPIRING_SOON: "bg-red-500/20 text-red-500",
    ALL_TICKETED: "bg-primary/20 text-primary",
    NOT_CHECKED_IN: "bg-orange-500/20 text-orange-500",
    CHECKED_IN: "bg-green-500/20 text-green-500",
  };
  return colorMap[segment] || "bg-muted text-muted-foreground";
}

export default function NotificationsPage() {
  const { mockMode } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTenantId, setSelectedTenantId] = useState<string>("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>("ALL");
  const [vipThreshold, setVipThreshold] = useState(500);
  const [dormantDays, setDormantDays] = useState(30);
  const [zipCodes, setZipCodes] = useState("");
  const [cities, setCities] = useState("");
  const [csvMemberIds, setCsvMemberIds] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [previewData, setPreviewData] = useState<SegmentPreview | null>(null);
  const [tierThresholds, setTierThresholds] = useState<TierThresholds | null>(null);

  const tenantsQuery = useQuery<{ success: boolean; data: Tenant[] }>({
    queryKey: ["/api/client/admin/tenants-with-programs"],
    queryFn: async () => {
      const res = await fetch("/api/client/admin/tenants-with-programs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      return res.json();
    },
    enabled: !mockMode,
  });

  const tenants = tenantsQuery.data?.data || [];
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId);
  const selectedProgram = selectedTenant?.programs.find((p) => p.id === selectedProgramId);

  const segmentsQuery = useQuery<{ success: boolean; data: { segments: SegmentInfo[]; tierThresholds?: TierThresholds } }>({
    queryKey: ["/api/client/admin/notifications/segments", selectedTenantId, selectedProgram?.id, selectedProgram?.protocol],
    queryFn: async () => {
      const params = new URLSearchParams({
        tenantId: selectedTenantId,
        programId: selectedProgram?.id || "",
        protocol: selectedProgram?.protocol || "",
      });
      const res = await fetch(`/api/client/admin/notifications/segments?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      return res.json();
    },
    enabled: !!selectedTenantId && !!selectedProgram?.id,
  });

  useEffect(() => {
    if (segmentsQuery.data?.data?.tierThresholds) {
      setTierThresholds(segmentsQuery.data.data.tierThresholds);
    }
  }, [segmentsQuery.data]);

  useEffect(() => {
    if (selectedProgram) {
      const segments = segmentsQuery.data?.data?.segments || [];
      const firstSegment = segments[0];
      if (firstSegment) {
        setSelectedSegment(firstSegment.type);
      }
    }
  }, [selectedProgram, segmentsQuery.data]);

  const logsQuery = useQuery<{ success: boolean; data: { logs: CampaignLog[] } }>({
    queryKey: ["/api/client/admin/notifications/logs"],
    queryFn: async () => {
      const res = await fetch("/api/client/admin/notifications/logs", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
      });
      return res.json();
    },
    enabled: !mockMode,
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const segmentConfig: Record<string, any> = {};
      if (selectedSegment === "VIP") segmentConfig.vipThreshold = vipThreshold;
      if (selectedSegment === "DORMANT") segmentConfig.dormantDays = dormantDays;
      if (selectedSegment === "GEO") segmentConfig.zipCodes = zipCodes.split(",").map((z) => z.trim()).filter(Boolean);
      if (selectedSegment === "CITY") segmentConfig.cities = cities.split(",").map((c) => c.trim()).filter(Boolean);
      if (selectedSegment === "CSV") segmentConfig.memberIds = csvMemberIds;

      const res = await apiRequest("POST", "/api/client/admin/notifications/segment/preview", {
        tenantId: selectedTenantId,
        programId: selectedProgram?.id,
        protocol: selectedProgram?.protocol,
        segment: selectedSegment,
        segmentConfig,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setPreviewData(data.data);
      setShowConfirmDialog(true);
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to get segment preview",
        variant: "destructive",
      });
    },
  });

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const segmentConfig: Record<string, any> = {};
      if (selectedSegment === "VIP") segmentConfig.vipThreshold = vipThreshold;
      if (selectedSegment === "DORMANT") segmentConfig.dormantDays = dormantDays;
      if (selectedSegment === "GEO") segmentConfig.zipCodes = zipCodes.split(",").map((z) => z.trim()).filter(Boolean);
      if (selectedSegment === "CITY") segmentConfig.cities = cities.split(",").map((c) => c.trim()).filter(Boolean);
      if (selectedSegment === "CSV") segmentConfig.memberIds = csvMemberIds;

      const res = await apiRequest("POST", "/api/client/admin/notifications/broadcast", {
        tenantId: selectedTenantId,
        programId: selectedProgram?.id,
        protocol: selectedProgram?.protocol,
        message,
        segment: selectedSegment,
        segmentConfig,
        campaignName: campaignName || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/client/admin/notifications/logs"] });
      toast({
        title: "Broadcast Sent!",
        description: `Successfully sent to ${data.data.successCount} of ${data.data.totalRecipients} recipients`,
      });
      setMessage("");
      setCampaignName("");
      setCsvMemberIds([]);
    },
    onError: (error: any) => {
      toast({
        title: "Broadcast Failed",
        description: error.message || "Failed to send broadcast",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n");
      const ids: string[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && trimmed.toLowerCase() !== "member_id" && trimmed.toLowerCase() !== "external_id") {
          ids.push(trimmed);
        }
      }

      setCsvMemberIds(ids);
      toast({
        title: "CSV Loaded",
        description: `Found ${ids.length} member IDs`,
      });
    };
    reader.readAsText(file);
  };

  const handlePreview = () => {
    if (!selectedTenantId || !selectedProgram) {
      toast({
        title: "Select Program",
        description: "Please select a tenant and program first",
        variant: "destructive",
      });
      return;
    }

    if (!message || message.length < 5) {
      toast({
        title: "Message Required",
        description: "Please enter a message (minimum 5 characters)",
        variant: "destructive",
      });
      return;
    }

    if (selectedSegment === "CSV" && csvMemberIds.length === 0) {
      toast({
        title: "No Member IDs",
        description: "Please upload a CSV file with member IDs",
        variant: "destructive",
      });
      return;
    }

    if (selectedSegment === "CITY" && !cities.trim()) {
      toast({
        title: "No Cities",
        description: "Please enter at least one city name",
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const segments = segmentsQuery.data?.data?.segments || [];

  const renderSegmentIcon = (iconName: string) => {
    const IconComponent = iconComponents[iconName] || Users;
    return <IconComponent className="h-4 w-4" />;
  };

  const ProtocolIcon = selectedProgram ? protocolIcons[selectedProgram.protocol] : Shield;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Push Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            Send targeted push notifications to digital wallet passes
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5" />
          Notification Engine
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Compose Broadcast
            </CardTitle>
            <CardDescription>
              Create and send push notifications to your members
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tenant">Select Tenant</Label>
              <Select
                value={selectedTenantId}
                onValueChange={(value) => {
                  setSelectedTenantId(value);
                  setSelectedProgramId("");
                  setSelectedSegment("ALL");
                }}
              >
                <SelectTrigger id="tenant" data-testid="select-tenant">
                  <SelectValue placeholder="Choose a tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTenant && (
              <div className="space-y-2">
                <Label htmlFor="program">Select Program</Label>
                <Select
                  value={selectedProgramId}
                  onValueChange={(value) => {
                    setSelectedProgramId(value);
                    setSelectedSegment("ALL");
                  }}
                >
                  <SelectTrigger id="program" data-testid="select-program">
                    <SelectValue placeholder="Choose a program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTenant.programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        <div className="flex items-center gap-2">
                          {program.name}
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${protocolColors[program.protocol]}`}>
                            {program.protocol}
                          </Badge>
                          {program.is_primary && <span className="text-xs text-muted-foreground">[Primary]</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProgram && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-muted/30 border border-border">
                <ProtocolIcon className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <div className="font-medium text-sm">{selectedProgram.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Protocol: <span className="font-medium">{selectedProgram.protocol}</span>
                    {tierThresholds && (
                      <span className="ml-2">
                        (Tiers: Bronze 0-{tierThresholds.bronze}, Silver {tierThresholds.bronze + 1}-{tierThresholds.silver}, Gold {tierThresholds.silver + 1}-{tierThresholds.gold}, Platinum {tierThresholds.gold + 1}+)
                      </span>
                    )}
                  </div>
                </div>
                <Badge className={protocolColors[selectedProgram.protocol]}>
                  {selectedProgram.protocol}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name (Optional)</Label>
              <Input
                id="campaign-name"
                placeholder="e.g., Holiday Promo 2025"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                data-testid="input-campaign-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Notification Message</Label>
              <Textarea
                id="message"
                placeholder="Your message will appear on the lock screen..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={500}
                data-testid="input-message"
              />
              <p className="text-xs text-muted-foreground text-right">
                {message.length}/500 characters
              </p>
            </div>

            <div className="space-y-3">
              <Label>
                Target Segment
                {selectedProgram && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({segments.length} available for {selectedProgram.protocol})
                  </span>
                )}
              </Label>
              {segmentsQuery.isLoading ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <RadioGroup
                  value={selectedSegment}
                  onValueChange={(v) => setSelectedSegment(v)}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                >
                  {segments.map((seg) => (
                    <div key={seg.type} className="relative">
                      <RadioGroupItem
                        value={seg.type}
                        id={seg.type}
                        className="peer sr-only"
                        data-testid={`radio-segment-${seg.type.toLowerCase()}`}
                      />
                      <Label
                        htmlFor={seg.type}
                        className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card/50 p-3 hover:bg-card hover:border-muted-foreground/50 peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                      >
                        <span className={`mb-1 rounded-full p-1.5 ${getSegmentColor(seg.type)}`}>
                          {renderSegmentIcon(seg.icon)}
                        </span>
                        <span className="text-xs font-medium">{seg.name}</span>
                        {seg.estimatedCount !== undefined && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            ~{seg.estimatedCount.toLocaleString()}
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            {selectedSegment === "VIP" && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label htmlFor="vip-threshold">VIP Point Threshold</Label>
                <Input
                  id="vip-threshold"
                  type="number"
                  min={0}
                  value={vipThreshold}
                  onChange={(e) => setVipThreshold(parseInt(e.target.value) || 0)}
                  data-testid="input-vip-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  Target members with {vipThreshold}+ points
                </p>
              </div>
            )}

            {selectedSegment === "DORMANT" && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label htmlFor="dormant-days">Inactive Days</Label>
                <Input
                  id="dormant-days"
                  type="number"
                  min={1}
                  max={365}
                  value={dormantDays}
                  onChange={(e) => setDormantDays(parseInt(e.target.value) || 30)}
                  data-testid="input-dormant-days"
                />
                <p className="text-xs text-muted-foreground">
                  Target members with no activity for {dormantDays}+ days
                </p>
              </div>
            )}

            {selectedSegment === "GEO" && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label htmlFor="zip-codes">ZIP Codes (comma separated)</Label>
                <Input
                  id="zip-codes"
                  placeholder="90210, 90211, 90212"
                  value={zipCodes}
                  onChange={(e) => setZipCodes(e.target.value)}
                  data-testid="input-zip-codes"
                />
                <p className="text-xs text-muted-foreground">
                  Target members in specific ZIP code areas
                </p>
              </div>
            )}

            {selectedSegment === "CITY" && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label htmlFor="cities">Cities (comma separated)</Label>
                <Input
                  id="cities"
                  placeholder="Los Angeles, New York, Chicago"
                  value={cities}
                  onChange={(e) => setCities(e.target.value)}
                  data-testid="input-cities"
                />
                <p className="text-xs text-muted-foreground">
                  Target members in specific cities
                </p>
              </div>
            )}

            {selectedSegment === "CSV" && (
              <div className="space-y-2 p-3 rounded-md bg-muted/30 border border-border">
                <Label>Upload Member List</Label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.txt"
                  className="hidden"
                  data-testid="input-csv-file"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  data-testid="button-upload-csv"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {csvMemberIds.length > 0
                    ? `${csvMemberIds.length} Member IDs Loaded`
                    : "Upload CSV File"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  CSV with column "member_id" or "external_id"
                </p>
              </div>
            )}

            <Button
              onClick={handlePreview}
              disabled={!selectedProgram || !message || previewMutation.isPending}
              className="w-full"
              data-testid="button-preview-broadcast"
            >
              {previewMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading Preview...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Preview & Send
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Campaign History
            </CardTitle>
            <CardDescription>Recent push notification campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {logsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : logsQuery.data?.data?.logs && logsQuery.data.data.logs.length > 0 ? (
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Segment</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsQuery.data.data.logs.slice(0, 10).map((log) => (
                      <TableRow key={log.id} data-testid={`row-campaign-${log.id}`}>
                        <TableCell>
                          <div className="font-medium text-foreground truncate max-w-[150px]">
                            {log.campaign_name}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            {formatDate(log.created_at)}
                            {log.programs?.protocol && (
                              <Badge variant="outline" className={`text-[9px] px-1 py-0 ml-1 ${protocolColors[log.programs.protocol as ProtocolType] || ""}`}>
                                {log.programs.protocol}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={getSegmentColor(log.target_segment)}
                          >
                            {log.target_segment}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.success_count}/{log.recipient_count}
                        </TableCell>
                        <TableCell>
                          {log.failed_count === 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : log.success_count === 0 ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No campaigns yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Broadcast
            </DialogTitle>
            <DialogDescription>
              Review the details before sending this push notification.
            </DialogDescription>
          </DialogHeader>

          {previewData && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={protocolColors[previewData.protocol]}>
                  {previewData.protocol}
                </Badge>
                <span className="text-sm text-muted-foreground">Protocol</span>
              </div>

              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                  Message Preview
                </div>
                <div className="text-sm text-foreground">{message}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Segment
                  </div>
                  <Badge className={getSegmentColor(previewData.segment)}>
                    <span className="ml-1">{previewData.segment}</span>
                  </Badge>
                </div>
                <div className="p-3 rounded-md bg-muted/50 border border-border">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                    Recipients
                  </div>
                  <div className="text-lg font-bold text-foreground">
                    {previewData.count.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-md bg-muted/50 border border-border">
                <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                  Sample Recipients
                </div>
                <div className="space-y-1.5">
                  {previewData.sampleMembers.slice(0, 3).map((member) => (
                    <div key={member.id} className="text-sm flex items-center justify-between">
                      <span className="text-foreground">
                        {member.firstName} {member.lastName}
                        {member.tierPoints !== undefined && (
                          <span className="text-xs text-muted-foreground ml-1">({member.tierPoints} pts)</span>
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground truncate max-w-[120px]">{member.email}</span>
                    </div>
                  ))}
                  {previewData.sampleMembers.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{previewData.sampleMembers.length - 3} more...
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-start gap-2">
                  <Bell className="h-4 w-4 text-yellow-500 mt-0.5" />
                  <p className="text-sm text-yellow-500">
                    This will send a push notification to {previewData.count.toLocaleString()} phones.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              data-testid="button-cancel-broadcast"
            >
              Cancel
            </Button>
            <Button
              onClick={() => broadcastMutation.mutate()}
              disabled={broadcastMutation.isPending}
              data-testid="button-confirm-broadcast"
            >
              {broadcastMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send to {previewData?.count.toLocaleString()} Members
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
