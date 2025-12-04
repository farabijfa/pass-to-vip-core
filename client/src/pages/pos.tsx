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
import { Search, Plus, Minus, CreditCard, Coins, CheckCircle, XCircle, Loader2, User, RefreshCw } from "lucide-react";

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
          <h1 className="text-2xl font-bold text-white" data-testid="text-pos-title">POS Simulator</h1>
          <p className="text-slate-400">Test earn and redeem transactions</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Mode</Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Member Lookup
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter member ID to start a transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="externalId" className="text-slate-200">External ID</Label>
              <div className="flex gap-2">
                <Input
                  id="externalId"
                  placeholder="PUB-abc123 or CLM-xyz789"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                  className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                  data-testid="input-external-id"
                />
                <Button 
                  onClick={handleLookup} 
                  disabled={isLookingUp}
                  data-testid="button-lookup"
                >
                  {isLookingUp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {member && (
              <div className="p-4 rounded-lg bg-slate-700/30 border border-slate-600" data-testid="card-member-info">
                <div className="flex items-center gap-4 mb-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-white text-lg" data-testid="text-member-name">
                      {member.first_name} {member.last_name}
                    </p>
                    <p className="text-sm text-slate-400">{member.email}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded bg-slate-800/50">
                    <p className="text-sm text-slate-400">Current Balance</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Coins className="h-5 w-5 text-yellow-500" />
                      <span className="text-2xl font-bold text-white" data-testid="text-points-balance">
                        {member.points_balance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded bg-slate-800/50">
                    <p className="text-sm text-slate-400">Tier</p>
                    <Badge variant="outline" className="mt-2" data-testid="badge-tier">
                      {member.tier_name}
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Transaction
            </CardTitle>
            <CardDescription className="text-slate-400">
              Process earn or redeem actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!member ? (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Look up a member to process transactions</p>
              </div>
            ) : (
              <Tabs defaultValue="earn" className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
                  <TabsTrigger value="earn" className="data-[state=active]:bg-green-600" data-testid="tab-earn">
                    <Plus className="h-4 w-4 mr-2" />
                    Earn
                  </TabsTrigger>
                  <TabsTrigger value="redeem" className="data-[state=active]:bg-red-600" data-testid="tab-redeem">
                    <Minus className="h-4 w-4 mr-2" />
                    Redeem
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="earn" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="earnPoints" className="text-slate-200">Points to Add</Label>
                    <Input
                      id="earnPoints"
                      type="number"
                      placeholder="100"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 text-xl"
                      data-testid="input-earn-points"
                    />
                  </div>
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={handleEarn}
                    disabled={isProcessing || !points}
                    data-testid="button-earn"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Points
                  </Button>
                </TabsContent>
                
                <TabsContent value="redeem" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="redeemPoints" className="text-slate-200">Points to Redeem</Label>
                    <Input
                      id="redeemPoints"
                      type="number"
                      placeholder="50"
                      value={points}
                      onChange={(e) => setPoints(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400 text-xl"
                      data-testid="input-redeem-points"
                    />
                    <p className="text-sm text-slate-400">
                      Available: {member.points_balance.toLocaleString()} points
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-red-600 hover:bg-red-700"
                    onClick={handleRedeem}
                    disabled={isProcessing || !points}
                    data-testid="button-redeem"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Minus className="h-4 w-4 mr-2" />
                    )}
                    Redeem Points
                  </Button>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {lastTransaction && (
        <Card className="border-slate-700 bg-slate-800/50" data-testid="card-transaction-result">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              {lastTransaction.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Last Transaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-400">Action</p>
                <Badge 
                  className={lastTransaction.action === "EARN" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}
                >
                  {lastTransaction.action}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400">Previous Balance</p>
                <p className="text-lg font-medium text-slate-300">{lastTransaction.previousBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">New Balance</p>
                <p className="text-lg font-medium text-white">{lastTransaction.newBalance.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Transaction ID</p>
                <code className="text-sm text-slate-300">{lastTransaction.transactionId}</code>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
              <p className="text-sm text-slate-400">
                {new Date(lastTransaction.timestamp).toLocaleString()}
              </p>
              <Button variant="outline" onClick={resetTransaction} className="border-slate-600" data-testid="button-new-transaction">
                <RefreshCw className="h-4 w-4 mr-2" />
                New Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mockMode && (
        <Card className="border-blue-500/30 bg-blue-500/10">
          <CardContent className="py-4">
            <p className="text-sm text-blue-300">
              <strong>Mock Mode:</strong> Try these member IDs: <code className="bg-blue-900/30 px-1 rounded">PUB-abc123</code>, 
              <code className="bg-blue-900/30 px-1 rounded ml-1">CLM-def456</code>, 
              <code className="bg-blue-900/30 px-1 rounded ml-1">PUB-ghi789</code>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
