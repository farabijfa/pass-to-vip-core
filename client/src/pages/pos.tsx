import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { posApi, type POSResponse, type Member } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function POSPage() {
  const { mockMode } = useAuth();
  const { toast } = useToast();
  
  const [externalId, setExternalId] = useState("");
  const [points, setPoints] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [member, setMember] = useState<Member | null>(null);
  const [lastTransaction, setLastTransaction] = useState<POSResponse | null>(null);

  const handleLookup = async () => {
    if (!externalId.trim()) {
      toast({ title: "Error", description: "Please enter a member ID", variant: "destructive" });
      return;
    }

    setIsLookingUp(true);
    setMember(null);
    setLastTransaction(null);

    try {
      const result = await posApi.lookup(externalId.trim());
      
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
  };

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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-pos-title">
            POS Simulator
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Test earn and redeem transactions
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
              Enter member ID to start a transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-foreground text-sm">External ID</Label>
              <div className="flex gap-2">
                <Input
                  id="externalId"
                  placeholder="PUB-abc123 or CLM-xyz789"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                  data-testid="input-external-id"
                />
                <Button 
                  onClick={handleLookup} 
                  disabled={isLookingUp}
                  data-testid="button-lookup"
                >
                  {isLookingUp ? "..." : "Lookup"}
                </Button>
              </div>
            </div>

            {member && (
              <div className="p-4 rounded-md border border-border" data-testid="card-member-info">
                <div className="mb-4">
                  <p className="font-medium text-foreground text-lg" data-testid="text-member-name">
                    {member.first_name} {member.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">{member.email}</p>
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
              <span className="font-medium">Test Mode:</span> Try member IDs: <code className="bg-muted px-1 rounded">PUB-abc123</code>, 
              <code className="bg-muted px-1 rounded ml-1">CLM-def456</code>, 
              <code className="bg-muted px-1 rounded ml-1">PUB-ghi789</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
