import { useAuth } from "@/lib/auth";
import { clientApi, type AnalyticsData, type Campaign } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Smartphone, 
  Mail, 
  QrCode,
  Send,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";

export default function DashboardPage() {
  const { user, mockMode } = useAuth();

  const { data: analyticsResult, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => clientApi.getAnalytics(),
    enabled: !!user,
  });

  const { data: campaignsResult, isLoading: campaignsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: () => clientApi.getCampaigns(5),
    enabled: !!user,
  });

  const analytics = analyticsResult?.data;
  const campaigns = campaignsResult?.data?.campaigns || [];

  const retentionRate = analytics?.totals.total 
    ? Math.round((analytics.totals.active / analytics.totals.total) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back to your loyalty program</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Data</Badge>
        )}
      </div>

      {user && (
        <Card className="border-border bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {user.programName}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Program ID: {user.programId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Protocol</p>
                <Badge variant="outline" className="mt-1" data-testid="badge-protocol">
                  {user.protocol}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge 
                  variant={user.isSuspended ? "destructive" : "default"} 
                  className="mt-1"
                  data-testid="badge-status"
                >
                  {user.isSuspended ? "Suspended" : "Active"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">PassKit ID</p>
                <code className="text-sm text-muted-foreground block mt-1 truncate" data-testid="text-passkit-id">
                  {user.passkitProgramId}
                </code>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="text-sm text-foreground mt-1" data-testid="text-created-at">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Members"
          value={analytics?.totals.total}
          icon={<Users className="h-5 w-5" />}
          loading={analyticsLoading}
          testId="stat-total-members"
        />
        <StatCard
          title="Active Passes"
          value={analytics?.totals.active}
          icon={<TrendingUp className="h-5 w-5" />}
          variant="success"
          loading={analyticsLoading}
          testId="stat-active-passes"
        />
        <StatCard
          title="Churned"
          value={analytics?.totals.churned}
          icon={<TrendingDown className="h-5 w-5" />}
          variant="warning"
          loading={analyticsLoading}
          testId="stat-churned"
        />
        <StatCard
          title="Retention Rate"
          value={retentionRate}
          suffix="%"
          icon={<Activity className="h-5 w-5" />}
          variant={retentionRate >= 70 ? "success" : retentionRate >= 50 ? "default" : "warning"}
          loading={analyticsLoading}
          testId="stat-retention"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-foreground">Enrollment Sources</CardTitle>
            <CardDescription className="text-muted-foreground">
              How members are joining your program
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 bg-muted" />
                <Skeleton className="h-20 bg-muted" />
                <Skeleton className="h-20 bg-muted" />
              </div>
            ) : analytics ? (
              <div className="space-y-4">
                <SourceCard
                  title="SmartPass / QR"
                  icon={<QrCode className="h-5 w-5" />}
                  data={analytics.sources.smartpass}
                  color="blue"
                  testId="source-smartpass"
                />
                <SourceCard
                  title="Direct Mail"
                  icon={<Mail className="h-5 w-5" />}
                  data={analytics.sources.csv}
                  color="red"
                  testId="source-csv"
                />
                <SourceCard
                  title="Claim Codes"
                  icon={<Smartphone className="h-5 w-5" />}
                  data={analytics.sources.claimCode}
                  color="white"
                  testId="source-claim-code"
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No analytics data available</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card/80">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Recent Campaigns
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your latest notification campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {campaignsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-16 bg-muted" />
                <Skeleton className="h-16 bg-muted" />
                <Skeleton className="h-16 bg-muted" />
              </div>
            ) : campaigns.length > 0 ? (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Send className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">No campaigns sent yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  variant = "default", 
  loading,
  testId,
  suffix = ""
}: { 
  title: string; 
  value?: number; 
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning";
  loading?: boolean;
  testId: string;
  suffix?: string;
}) {
  const colorClasses = {
    default: "text-primary",
    success: "text-primary",
    warning: "text-secondary",
  };

  return (
    <Card className="border-border bg-card/80" data-testid={testId}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1 bg-muted" />
            ) : (
              <p className={`text-2xl font-bold ${colorClasses[variant]}`}>
                {value?.toLocaleString() ?? "-"}{suffix}
              </p>
            )}
          </div>
          <div className={`${colorClasses[variant]} opacity-50`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SourceCard({ 
  title, 
  icon, 
  data, 
  color,
  testId 
}: { 
  title: string; 
  icon: React.ReactNode;
  data: { total: number; active: number; churned: number };
  color: "blue" | "red" | "white";
  testId: string;
}) {
  const colorClasses = {
    blue: "text-primary",
    red: "text-secondary",
    white: "text-foreground",
  };

  const bgClasses = {
    blue: "bg-primary/10",
    red: "bg-secondary/10",
    white: "bg-muted/30",
  };

  const activeRate = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;

  return (
    <div className={`rounded-lg p-4 ${bgClasses[color]}`} data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={colorClasses[color]}>{icon}</span>
          <span className={`font-medium ${colorClasses[color]}`}>{title}</span>
        </div>
        <Badge variant="outline" className="text-xs">
          {activeRate}% active
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xl font-bold text-foreground">{data.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div>
          <p className="text-xl font-bold text-primary">{data.active.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div>
          <p className="text-xl font-bold text-secondary">{data.churned.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Churned</p>
        </div>
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const successRate = campaign.successRate;
  
  return (
    <div 
      className="rounded-lg border border-border bg-muted/20 p-4"
      data-testid={`campaign-${campaign.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-medium text-foreground">{campaign.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {campaign.targetSegment}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <Badge 
          variant={successRate >= 90 ? "default" : successRate >= 70 ? "secondary" : "outline"}
          className="text-xs"
        >
          {successRate}% success
        </Badge>
      </div>
      
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Delivery Progress</span>
          <span>{campaign.successCount} / {campaign.recipientCount}</span>
        </div>
        <Progress value={successRate} className="h-1.5" />
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs">
        <span className="flex items-center gap-1 text-primary">
          <CheckCircle className="h-3 w-3" />
          {campaign.successCount} delivered
        </span>
        {campaign.failedCount > 0 && (
          <span className="flex items-center gap-1 text-secondary">
            <XCircle className="h-3 w-3" />
            {campaign.failedCount} failed
          </span>
        )}
      </div>
    </div>
  );
}
