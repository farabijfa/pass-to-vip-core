import { useAuth } from "@/lib/auth";
import { clientApi, type AnalyticsData, type Campaign } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

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
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Welcome back to your loyalty program
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      {user && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-lg" data-testid="text-program-name">
              {user.programName}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              Program ID: {user.programId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Protocol</p>
                <p className="text-sm font-medium text-foreground mt-1" data-testid="badge-protocol">
                  {user.protocol}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                <p className={`text-sm font-medium mt-1 ${user.isSuspended ? 'text-destructive' : 'text-foreground'}`} data-testid="badge-status">
                  {user.isSuspended ? "Suspended" : "Active"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">PassKit ID</p>
                <code className="text-sm text-muted-foreground block mt-1 truncate" data-testid="text-passkit-id">
                  {user.passkitProgramId}
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Member Since</p>
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
          loading={analyticsLoading}
          testId="stat-total-members"
        />
        <StatCard
          title="Active Passes"
          value={analytics?.totals.active}
          loading={analyticsLoading}
          testId="stat-active-passes"
        />
        <StatCard
          title="Churned"
          value={analytics?.totals.churned}
          loading={analyticsLoading}
          testId="stat-churned"
        />
        <StatCard
          title="Retention Rate"
          value={retentionRate}
          suffix="%"
          loading={analyticsLoading}
          testId="stat-retention"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Enrollment Sources</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
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
                  title="In-Store QR"
                  data={analytics.sources.smartpass}
                  testId="source-smartpass"
                />
                <SourceCard
                  title="Mailed Campaign"
                  data={analytics.sources.claimCode}
                  testId="source-claim-code"
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">No analytics data available</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-foreground text-lg">Recent Campaigns</CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
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
                <p className="text-muted-foreground text-sm">No campaigns sent yet</p>
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
  loading,
  testId,
  suffix = ""
}: { 
  title: string; 
  value?: number; 
  loading?: boolean;
  testId: string;
  suffix?: string;
}) {
  return (
    <Card className="border-border" data-testid={testId}>
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
        {loading ? (
          <Skeleton className="h-8 w-20 mt-2 bg-muted" />
        ) : (
          <p className="text-2xl font-semibold text-foreground mt-2">
            {value?.toLocaleString() ?? "-"}{suffix}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SourceCard({ 
  title, 
  data, 
  testId 
}: { 
  title: string; 
  data: { total: number; active: number; churned: number };
  testId: string;
}) {
  const activeRate = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;

  return (
    <div className="rounded-md border border-border p-4" data-testid={testId}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-foreground text-sm">{title}</span>
        <span className="text-xs text-muted-foreground">{activeRate}% active</span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xl font-semibold text-foreground">{data.total.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-foreground">{data.active.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div>
          <p className="text-xl font-semibold text-muted-foreground">{data.churned.toLocaleString()}</p>
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
      className="rounded-md border border-border p-4"
      data-testid={`campaign-${campaign.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h4 className="font-medium text-foreground text-sm">{campaign.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {campaign.targetSegment}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(campaign.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
        <span className="text-xs font-medium text-foreground">
          {successRate}% success
        </span>
      </div>
      
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>Delivery Progress</span>
          <span>{campaign.successCount} / {campaign.recipientCount}</span>
        </div>
        <Progress value={successRate} className="h-1" />
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
        <span>{campaign.successCount} delivered</span>
        {campaign.failedCount > 0 && (
          <span>{campaign.failedCount} failed</span>
        )}
      </div>
    </div>
  );
}
