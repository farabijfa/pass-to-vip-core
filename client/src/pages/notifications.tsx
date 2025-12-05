import { useState, useRef } from "react";
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
} from "lucide-react";

type SegmentType = "ALL" | "VIP" | "DORMANT" | "GEO" | "CSV";

interface SegmentInfo {
  type: SegmentType;
  name: string;
  description: string;
  estimatedCount?: number;
}

interface SegmentPreview {
  segment: SegmentType;
  description: string;
  count: number;
  sampleMembers: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    pointsBalance?: number;
    lastUpdated?: string;
    zipCode?: string;
  }>;
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
  };
}

interface Tenant {
  id: string;
  name: string;
  programs: Array<{
    id: string;
    name: string;
    protocol: string;
    passkit_program_id: string;
    is_primary: boolean;
  }>;
}

const segmentIcons: Record<SegmentType, React.ReactNode> = {
  ALL: <Users className="h-4 w-4" />,
  VIP: <Crown className="h-4 w-4" />,
  DORMANT: <Clock className="h-4 w-4" />,
  GEO: <MapPin className="h-4 w-4" />,
  CSV: <FileSpreadsheet className="h-4 w-4" />,
};

const segmentColors: Record<SegmentType, string> = {
  ALL: "bg-primary/20 text-primary",
  VIP: "bg-yellow-500/20 text-yellow-500",
  DORMANT: "bg-orange-500/20 text-orange-500",
  GEO: "bg-green-500/20 text-green-500",
  CSV: "bg-purple-500/20 text-purple-500",
};

export default function NotificationsPage() {
  const { user, mockMode } = useAuth();
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
  const [csvMemberIds, setCsvMemberIds] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [previewData, setPreviewData] = useState<SegmentPreview | null>(null);

  const tenantsQuery = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
    enabled: !mockMode,
  });

  const selectedTenant = tenantsQuery.data?.find((t) => t.id === selectedTenantId);
  const selectedProgram = selectedTenant?.programs.find((p) => p.id === selectedProgramId);

  const segmentsQuery = useQuery<{ success: boolean; data: { segments: SegmentInfo[] } }>({
    queryKey: ["/api/notifications/segments", selectedProgram?.passkit_program_id],
    enabled: !!selectedProgram?.passkit_program_id,
  });

  const logsQuery = useQuery<{ success: boolean; data: { logs: CampaignLog[] } }>({
    queryKey: ["/api/notifications/logs"],
    enabled: !mockMode,
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const segmentConfig: Record<string, any> = {};
      if (selectedSegment === "VIP") segmentConfig.vipThreshold = vipThreshold;
      if (selectedSegment === "DORMANT") segmentConfig.dormantDays = dormantDays;
      if (selectedSegment === "GEO") segmentConfig.zipCodes = zipCodes.split(",").map((z) => z.trim()).filter(Boolean);
      if (selectedSegment === "CSV") segmentConfig.memberIds = csvMemberIds;

      const res = await apiRequest("POST", "/api/notifications/segment/preview", {
        programId: selectedProgram?.passkit_program_id,
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
      if (selectedSegment === "CSV") segmentConfig.memberIds = csvMemberIds;

      const res = await apiRequest("POST", "/api/notifications/broadcast", {
        programId: selectedProgram?.passkit_program_id,
        message,
        segment: selectedSegment,
        segmentConfig,
        campaignName: campaignName || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setShowConfirmDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/logs"] });
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
    if (!selectedProgram?.passkit_program_id) {
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

    previewMutation.mutate();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const segments = segmentsQuery.data?.data?.segments || [];

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
                }}
              >
                <SelectTrigger id="tenant" data-testid="select-tenant">
                  <SelectValue placeholder="Choose a tenant..." />
                </SelectTrigger>
                <SelectContent>
                  {tenantsQuery.data?.map((tenant) => (
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
                <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                  <SelectTrigger id="program" data-testid="select-program">
                    <SelectValue placeholder="Choose a program..." />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedTenant.programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name} ({program.protocol})
                        {program.is_primary && " [Primary]"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <Label>Target Segment</Label>
              <RadioGroup
                value={selectedSegment}
                onValueChange={(v) => setSelectedSegment(v as SegmentType)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {(["ALL", "VIP", "DORMANT", "GEO", "CSV"] as SegmentType[]).map((seg) => {
                  const segmentInfo = segments.find((s) => s.type === seg);
                  return (
                    <div key={seg} className="relative">
                      <RadioGroupItem
                        value={seg}
                        id={seg}
                        className="peer sr-only"
                        data-testid={`radio-segment-${seg.toLowerCase()}`}
                      />
                      <Label
                        htmlFor={seg}
                        className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-card/50 p-3 hover:bg-card hover:border-muted-foreground/50 peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                      >
                        <span className={`mb-1 rounded-full p-1.5 ${segmentColors[seg]}`}>
                          {segmentIcons[seg]}
                        </span>
                        <span className="text-xs font-medium">{seg}</span>
                        {segmentInfo?.estimatedCount !== undefined && (
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            ~{segmentInfo.estimatedCount.toLocaleString()}
                          </span>
                        )}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
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
                          <div className="text-xs text-muted-foreground">
                            {formatDate(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={segmentColors[log.target_segment as SegmentType] || ""}
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
                  <Badge className={segmentColors[previewData.segment]}>
                    {segmentIcons[previewData.segment]}
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
                      </span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
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
