import { useAuth } from "@/lib/auth";
import { clientApi } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { TrendingUp, PieChartIcon, BarChart3 } from "lucide-react";

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];

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
          <h1 className="text-2xl font-bold text-white" data-testid="text-analytics-title">Analytics</h1>
          <p className="text-slate-400">Detailed insights into your loyalty program</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Data</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 bg-slate-700" />
          <Skeleton className="h-80 bg-slate-700" />
          <Skeleton className="h-80 bg-slate-700 lg:col-span-2" />
        </div>
      ) : analytics ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-700 bg-slate-800/50" data-testid="card-enrollment-distribution">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                  Enrollment Distribution
                </CardTitle>
                <CardDescription className="text-slate-400">
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
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#e2e8f0' }}
                      />
                      <Legend 
                        wrapperStyle={{ color: '#94a3b8' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-800/50" data-testid="card-retention-rate">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Retention Rate
                </CardTitle>
                <CardDescription className="text-slate-400">
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
                        <Cell fill="#22c55e" />
                        <Cell fill="#ef4444" />
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          border: '1px solid #334155',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-3xl font-bold text-green-500" data-testid="text-retention-rate">
                    {analytics.totals.total > 0 
                      ? Math.round((analytics.totals.active / analytics.totals.total) * 100) 
                      : 0}%
                  </p>
                  <p className="text-sm text-slate-400">Overall Retention</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-700 bg-slate-800/50" data-testid="card-source-performance">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Source Performance
              </CardTitle>
              <CardDescription className="text-slate-400">
                Active vs churned by enrollment source
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        border: '1px solid #334155',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend wrapperStyle={{ color: '#94a3b8' }} />
                    <Bar dataKey="active" name="Active" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="churned" name="Churned" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-800/50" data-testid="card-summary-table">
            <CardHeader>
              <CardTitle className="text-white">Summary Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-4 text-slate-400">Source</th>
                      <th className="text-right py-3 px-4 text-slate-400">Total</th>
                      <th className="text-right py-3 px-4 text-slate-400">Active</th>
                      <th className="text-right py-3 px-4 text-slate-400">Churned</th>
                      <th className="text-right py-3 px-4 text-slate-400">Retention</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(analytics.bySource).map(([source, data]) => (
                      <tr key={source} className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-white">{source}</td>
                        <td className="py-3 px-4 text-right text-slate-300">{data.total.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-green-400">{data.active.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-red-400">{data.churned.toLocaleString()}</td>
                        <td className="py-3 px-4 text-right text-blue-400">
                          {data.total > 0 ? Math.round((data.active / data.total) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                    <tr className="font-bold">
                      <td className="py-3 px-4 text-white">Total</td>
                      <td className="py-3 px-4 text-right text-white">{analytics.totals.total.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-green-400">{analytics.totals.active.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-red-400">{analytics.totals.churned.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-blue-400">
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
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">No analytics data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
