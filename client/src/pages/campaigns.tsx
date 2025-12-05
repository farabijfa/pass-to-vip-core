import { useState, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { isMockMode } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

const POSTCARD_PRICING: Record<string, number> = {
  "6x4": 0.89,
  "9x6": 1.29,
  "11x6": 1.49,
};

export default function CampaignsPage() {
  const { user, mockMode } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [postcardSize, setPostcardSize] = useState<string>("6x4");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchResult, setLaunchResult] = useState<CampaignResult | null>(null);

  const estimatedCost = preview 
    ? (preview.valid * POSTCARD_PRICING[postcardSize]).toFixed(2)
    : "0.00";

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
    if (!file || !preview || !user) return;

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
            resourceType: "postcard",
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
          description: `${mockResult.summary.success} postcards simulated`,
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("program_id", user.programId);
      formData.append("resource_type", "postcard");
      formData.append("size", postcardSize);
      formData.append("front_template_id", "tmpl_demo");
      formData.append("description", `Campaign from ${file.name}`);

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
          description: `${result.data.summary.success} postcards queued for delivery`,
        });
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
            Upload your customer list and send personalized postcards
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      {launchResult ? (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              Campaign Complete
              <Badge variant="default">{launchResult.summary.success} sent</Badge>
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Your postcards have been queued for delivery
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
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Upload Customer List</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Drag and drop a CSV file with your customer addresses
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

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Campaign Preview</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Review before launching your campaign
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

                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Postcard Size</span>
                      <Select value={postcardSize} onValueChange={setPostcardSize}>
                        <SelectTrigger className="w-32" data-testid="select-postcard-size">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6x4">6" x 4"</SelectItem>
                          <SelectItem value="9x6">9" x 6"</SelectItem>
                          <SelectItem value="11x6">11" x 6"</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm text-muted-foreground">Price per card</span>
                      <span className="text-sm font-medium text-foreground">
                        ${POSTCARD_PRICING[postcardSize].toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-md bg-primary/5 border border-primary/20">
                      <span className="text-sm font-medium text-foreground">Estimated Total</span>
                      <span className="text-2xl font-semibold text-primary" data-testid="text-estimated-cost">
                        ${estimatedCost}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setShowConfirmModal(true)}
                    disabled={preview.valid === 0 || isLaunching}
                    data-testid="button-launch-campaign"
                  >
                    {isLaunching ? "Launching..." : `Launch Campaign (${preview.valid} postcards)`}
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
      )}

      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Campaign Launch</DialogTitle>
            <DialogDescription>
              You are about to send {preview?.valid} postcards. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-4 rounded-md bg-muted/50">
              <span className="text-sm text-muted-foreground">Total Cost</span>
              <span className="text-xl font-semibold text-foreground">${estimatedCost}</span>
            </div>
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
