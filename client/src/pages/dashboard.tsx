import { useAuth } from "@/lib/auth";
import { clientApi, type AnalyticsData } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, TrendingUp, TrendingDown, Activity, Smartphone, Mail, QrCode } from "lucide-react";

export default function DashboardPage() {
  const { user, mockMode } = useAuth();

  const { data: analyticsResult, isLoading: analyticsLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => clientApi.getAnalytics(),
    enabled: !!user,
  });

  const analytics = analyticsResult?.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-slate-400">Welcome back to your loyalty program</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Data</Badge>
        )}
      </div>

      {user && (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              {user.programName}
            </CardTitle>
            <CardDescription className="text-slate-400">
              Program ID: {user.programId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-slate-400">Protocol</p>
                <Badge variant="outline" className="mt-1" data-testid="badge-protocol">
                  {user.protocol}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400">Status</p>
                <Badge 
                  variant={user.isSuspended ? "destructive" : "default"} 
                  className="mt-1"
                  data-testid="badge-status"
                >
                  {user.isSuspended ? "Suspended" : "Active"}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-400">PassKit ID</p>
                <code className="text-sm text-slate-300 block mt-1 truncate" data-testid="text-passkit-id">
                  {user.passkitProgramId}
                </code>
              </div>
              <div>
                <p className="text-sm text-slate-400">Member Since</p>
                <p className="text-sm text-slate-300 mt-1" data-testid="text-created-at">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      </div>

      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white">Enrollment Sources</CardTitle>
          <CardDescription className="text-slate-400">
            How members are joining your program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 bg-slate-700" />
              <Skeleton className="h-20 bg-slate-700" />
              <Skeleton className="h-20 bg-slate-700" />
            </div>
          ) : analytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SourceCard
                title="SmartPass / QR"
                icon={<QrCode className="h-6 w-6" />}
                data={analytics.sources.smartpass}
                color="blue"
                testId="source-smartpass"
              />
              <SourceCard
                title="Direct Mail"
                icon={<Mail className="h-6 w-6" />}
                data={analytics.sources.csv}
                color="purple"
                testId="source-csv"
              />
              <SourceCard
                title="Claim Codes"
                icon={<Smartphone className="h-6 w-6" />}
                data={analytics.sources.claimCode}
                color="green"
                testId="source-claim-code"
              />
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No analytics data available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  variant = "default", 
  loading,
  testId 
}: { 
  title: string; 
  value?: number; 
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning";
  loading?: boolean;
  testId: string;
}) {
  const colorClasses = {
    default: "text-primary",
    success: "text-green-500",
    warning: "text-yellow-500",
  };

  return (
    <Card className="border-slate-700 bg-slate-800/50" data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1 bg-slate-700" />
            ) : (
              <p className={`text-3xl font-bold ${colorClasses[variant]}`}>
                {value?.toLocaleString() ?? "-"}
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
  color: "blue" | "purple" | "green";
  testId: string;
}) {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    green: "bg-green-500/10 text-green-400 border-green-500/20",
  };

  const activeRate = data.total > 0 ? Math.round((data.active / data.total) * 100) : 0;

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`} data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-bold">{data.total.toLocaleString()}</p>
          <p className="text-xs opacity-70">Total</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{data.active.toLocaleString()}</p>
          <p className="text-xs opacity-70">Active</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{activeRate}%</p>
          <p className="text-xs opacity-70">Rate</p>
        </div>
      </div>
    </div>
  );
}
