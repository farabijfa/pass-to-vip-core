import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { posApi, type POSResponse, type Member } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Html5Qrcode } from "html5-qrcode";

function parseMemberCode(rawCode: string): string {
  if (!rawCode || typeof rawCode !== "string") return "";
  
  let code = rawCode.trim();
  
  try {
    const url = new URL(code);
    const codeParam = url.searchParams.get("code") || 
                      url.searchParams.get("member") || 
                      url.searchParams.get("id");
    if (codeParam) {
      code = codeParam;
    } else {
      const pathParts = url.pathname.split("/").filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart && /^(PUB|CLM|MBR)-/i.test(lastPart)) {
        code = lastPart;
      }
    }
  } catch {
  }
  
  const prefixMatch = code.match(/(PUB|CLM|MBR)-[A-Za-z0-9]+/i);
  if (prefixMatch) {
    return prefixMatch[0].toUpperCase();
  }
  
  const cleanCode = code.replace(/[^A-Za-z0-9-]/g, "");
  return cleanCode.toUpperCase();
}

export default function POSPage() {
  const { mockMode } = useAuth();
  const { toast } = useToast();
  
  const [externalId, setExternalId] = useState("");
  const [points, setPoints] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [lastTransaction, setLastTransaction] = useState<POSResponse | null>(null);
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleLookup = useCallback(async (idToLookup?: string) => {
    const lookupId = idToLookup || externalId.trim();
    if (!lookupId) {
      toast({ title: "Error", description: "Please enter a member ID", variant: "destructive" });
      return;
    }

    setIsLookingUp(true);
    setMember(null);
    setLastTransaction(null);

    try {
      const result = await posApi.lookup(lookupId);
      
      if (result.success && result.data) {
        setMember(result.data.member);
        toast({ title: "Member Found", description: `${result.data.member.first_name} ${result.data.member.last_name}` });
      } else {
        toast({ 
          title: "Not Found", 
          description: result.error?.message || "Member not found",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Lookup failed",
        variant: "destructive"
      });
    } finally {
      setIsLookingUp(false);
    }
  }, [externalId, toast]);

  const handleEarn = async () => {
    if (!member || !points) return;
    
    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      toast({ title: "Error", description: "Please enter a valid points amount", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    
    try {
      const result = await posApi.earn(member.external_id, pointsNum);
      
      if (result.success && result.data) {
        setLastTransaction(result.data);
        setMember({ ...member, points_balance: result.data.newBalance });
        setPoints("");
        toast({ 
          title: "Points Earned!", 
          description: `Added ${pointsNum} points. New balance: ${result.data.newBalance}` 
        });
      } else {
        toast({ 
          title: "Transaction Failed", 
          description: result.error?.message || "Could not process earn",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRedeem = async () => {
    if (!member || !points) return;
    
    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      toast({ title: "Error", description: "Please enter a valid points amount", variant: "destructive" });
      return;
    }

    if (pointsNum > member.points_balance) {
      toast({ title: "Insufficient Balance", description: "Not enough points to redeem", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    
    try {
      const result = await posApi.redeem(member.external_id, pointsNum);
      
      if (result.success && result.data) {
        setLastTransaction(result.data);
        setMember({ ...member, points_balance: result.data.newBalance });
        setPoints("");
        toast({ 
          title: "Points Redeemed!", 
          description: `Redeemed ${pointsNum} points. New balance: ${result.data.newBalance}` 
        });
      } else {
        toast({ 
          title: "Transaction Failed", 
          description: result.error?.message || "Could not process redemption",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err instanceof Error ? err.message : "Transaction failed",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetTransaction = () => {
    setExternalId("");
    setPoints("");
    setMember(null);
    setLastTransaction(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const focusScanField = () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) {
          await scannerRef.current.stop();
        }
      } catch (err) {
        console.log("Scanner stop error (likely already stopped):", err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          const parsedCode = parseMemberCode(decodedText);
          if (parsedCode) {
            stopScanner();
            setIsScannerOpen(false);
            setExternalId(parsedCode);
            toast({ title: "Code Scanned", description: `Found: ${parsedCode}` });
            setTimeout(() => handleLookup(parsedCode), 100);
          }
        },
        () => {}
      );
    } catch (err) {
      console.error("Scanner error:", err);
      setIsScanning(false);
      
      if (err instanceof Error) {
        if (err.message.includes("Permission")) {
          setCameraError("Camera access was denied. Please allow camera access in your browser settings.");
        } else if (err.message.includes("NotFound") || err.message.includes("no camera")) {
          setCameraError("No camera found on this device.");
        } else {
          setCameraError(`Camera error: ${err.message}`);
        }
      } else {
        setCameraError("Unable to access camera. Please check permissions.");
      }
    }
  }, [stopScanner, toast, handleLookup]);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        stopScanner();
      }
    };
  }, [stopScanner]);

  const handleOpenScanner = () => {
    setCameraError(null);
    setIsScannerOpen(true);
  };

  const handleCloseScanner = async () => {
    await stopScanner();
    setIsScannerOpen(false);
  };

  useEffect(() => {
    if (isScannerOpen && !isScanning && !cameraError) {
      const timer = setTimeout(() => {
        startScanner();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isScannerOpen, isScanning, cameraError, startScanner]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-pos-title">
            POS Simulator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan or enter member ID to process transactions
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Member Lookup</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Scan QR code or enter member ID
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button 
                variant="outline" 
                onClick={handleOpenScanner}
                className="flex-1 min-w-[140px]"
                data-testid="button-scan-camera"
              >
                Scan with Camera
              </Button>
              <Button 
                variant="ghost" 
                onClick={focusScanField}
                className="flex-1 min-w-[140px]"
                data-testid="button-focus-scan"
              >
                Focus Scan Field
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-foreground text-sm">External ID</Label>
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  id="externalId"
                  placeholder="Scan or type: PUB-abc123"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground font-mono"
                  autoComplete="off"
                  autoFocus
                  data-testid="input-external-id"
                />
                <Button 
                  onClick={() => handleLookup()} 
                  disabled={isLookingUp}
                  data-testid="button-lookup"
                >
                  {isLookingUp ? "..." : "Lookup"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                External scanners: point and scan. Press Enter to search manually.
              </p>
            </div>

            {member && (
              <div className="p-4 rounded-md border border-border" data-testid="card-member-info">
                <div className="mb-4">
                  <p className="font-medium text-foreground text-lg" data-testid="text-member-name">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
                  <code className="text-xs text-muted-foreground mt-1 block">{member.external_id}</code>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-md bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Balance</p>
                    <p className="text-2xl font-semibold text-foreground mt-1" data-testid="text-points-balance">
                      {member.points_balance.toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-muted/30">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Tier</p>
                    <p className="text-lg font-medium text-foreground mt-1" data-testid="badge-tier">
                      {member.tier_name}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Transaction</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Process earn or redeem actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!member ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">Look up a member to process transactions</p>
              </div>
            ) : (
              <Tabs defaultValue="earn" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="earn" data-testid="tab-earn">
                    Earn
                  </TabsTrigger>
                  <TabsTrigger value="redeem" data-testid="tab-redeem">
                    Redeem
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="earn" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="earnPoints" className="text-foreground text-sm">Points to Add</Label>
                    <Input
                      id="earnPoints"
                      type="number"
                      placeholder="100"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xl"
                      data-testid="input-earn-points"
                    />
                  </div>
                  <Button 
                    className="w-full"
                    onClick={handleEarn}
                    disabled={isProcessing || !points}
                    data-testid="button-earn"
                  >
                    {isProcessing ? "Processing..." : "Add Points"}
                  </Button>
                </TabsContent>
                
                <TabsContent value="redeem" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="redeemPoints" className="text-foreground text-sm">Points to Redeem</Label>
                    <Input
                      id="redeemPoints"
                      type="number"
                      placeholder="50"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="bg-background border-border text-foreground placeholder:text-muted-foreground text-xl"
                      data-testid="input-redeem-points"
                    />
                    <p className="text-xs text-muted-foreground">
                      Available: {member.points_balance.toLocaleString()} points
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    className="w-full"
                    onClick={handleRedeem}
                    disabled={isProcessing || !points}
                    data-testid="button-redeem"
                  >
                    {isProcessing ? "Processing..." : "Redeem Points"}
                  </Button>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {lastTransaction && (
        <Card className="border-border" data-testid="card-transaction-result">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Last Transaction</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Action</p>
                <p className="text-sm font-medium text-foreground mt-1">{lastTransaction.action}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Previous</p>
                <p className="text-lg font-medium text-muted-foreground">{lastTransaction.previousBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">New Balance</p>
                <p className="text-lg font-medium text-foreground">{lastTransaction.newBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Transaction ID</p>
                <code className="text-xs text-muted-foreground">{lastTransaction.transactionId}</code>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border flex flex-wrap justify-between items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {new Date(lastTransaction.timestamp).toLocaleString()}
              </p>
              <Button variant="outline" onClick={resetTransaction} data-testid="button-new-transaction">
                New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mockMode && (
        <Card className="border-border">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Test Mode:</span> Try scanning or typing: 
              <code className="bg-muted px-1 rounded ml-1">PUB-abc123</code>, 
              <code className="bg-muted px-1 rounded ml-1">CLM-def456</code>, 
              <code className="bg-muted px-1 rounded ml-1">PUB-ghi789</code>
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isScannerOpen} onOpenChange={(open) => !open && handleCloseScanner()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the member's QR code
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative">
            <div 
              id="qr-reader" 
              className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
              data-testid="qr-scanner-preview"
            />
            
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-primary rounded-lg opacity-50" />
              </div>
            )}
            
            {cameraError && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/90 rounded-lg p-4">
                <div className="text-center">
                  <p className="text-sm text-destructive mb-4">{cameraError}</p>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setCameraError(null);
                      startScanner();
                    }}
                    data-testid="button-retry-camera"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={handleCloseScanner}
              data-testid="button-cancel-scan"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
