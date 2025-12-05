import { useAuth } from "@/lib/auth";
import { clientApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#3b82f6",
  "#0ea5e9",
  "#6366f1"
];

export default function AnalyticsPage() {
  const { user, mockMode } = useAuth();

  const { data: analyticsResult, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => clientApi.getAnalytics(),
    enabled: !!user,
  });

  const analytics = analyticsResult?.data;

  const barChartData = analytics ? [
    { name: "QR/SmartPass", active: analytics.sources.smartpass.active, churned: analytics.sources.smartpass.churned },
    { name: "Direct Mail", active: analytics.sources.csv.active, churned: analytics.sources.csv.churned },
    { name: "Claim Codes", active: analytics.sources.claimCode.active, churned: analytics.sources.claimCode.churned },
  ] : [];

  const pieChartData = analytics ? [
    { name: "QR/SmartPass", value: analytics.sources.smartpass.total },
    { name: "Direct Mail", value: analytics.sources.csv.total },
    { name: "Claim Codes", value: analytics.sources.claimCode.total },
  ].filter(d => d.value > 0) : [];

  const retentionData = analytics ? [
    { name: "Active", value: analytics.totals.active },
    { name: "Churned", value: analytics.totals.churned },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-analytics-title">
            Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detailed insights into your loyalty program
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 bg-muted" />
          <Skeleton className="h-80 bg-muted" />
          <Skeleton className="h-80 bg-muted lg:col-span-2" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-border" data-testid="card-enrollment-distribution">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Enrollment Distribution</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Breakdown by enrollment source
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--foreground))'
                        }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Legend 
                        wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border" data-testid="card-retention-rate">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Retention Rate</CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  Active vs churned members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={retentionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        <Cell fill="#2563eb" />
                        <Cell fill="#dc2626" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--foreground))'
                        }}
                      />
                      <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-3xl font-semibold text-foreground" data-testid="text-retention-rate">
                    {analytics.totals.total > 0 
                      ? Math.round((analytics.totals.active / analytics.totals.total) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Overall Retention</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border" data-testid="card-source-performance">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Source Performance</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Active vs churned by enrollment source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--foreground))'
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))' }} />
                    <Bar dataKey="active" name="Active" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="churned" name="Churned" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border" data-testid="card-summary-table">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Summary Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 text-xs text-muted-foreground uppercase tracking-wider">Source</th>
                      <th className="text-right py-3 px-4 text-xs text-muted-foreground uppercase tracking-wider">Total</th>
                      <th className="text-right py-3 px-4 text-xs text-muted-foreground uppercase tracking-wider">Active</th>
                      <th className="text-right py-3 px-4 text-xs text-muted-foreground uppercase tracking-wider">Churned</th>
                      <th className="text-right py-3 px-4 text-xs text-muted-foreground uppercase tracking-wider">Retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.bySource).map(([source, data]) => (
                      <tr key={source} className="border-b border-border/50">
                        <td className="py-3 px-4 text-foreground">{source}</td>
                        <td className="py-3 px-4 text-right text-foreground">{data.total.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-foreground">{data.active.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-muted-foreground">{data.churned.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {data.total > 0 ? Math.round((data.active / data.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                    <tr className="font-medium">
                      <td className="py-3 px-4 text-foreground">Total</td>
                      <td className="py-3 px-4 text-right text-foreground">{analytics.totals.total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-foreground">{analytics.totals.active.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{analytics.totals.churned.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-foreground">
                        {analytics.totals.total > 0 ? Math.round((analytics.totals.active / analytics.totals.total) * 100) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No analytics data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
