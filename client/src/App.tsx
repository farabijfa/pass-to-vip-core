import { useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import AnalyticsPage from "@/pages/analytics";
import MembersPage from "@/pages/members";
import AssetsPage from "@/pages/assets";
import CampaignsPage from "@/pages/campaigns";
import POSPage from "@/pages/pos";
import AdminClientsPage from "@/pages/admin-clients";
import AdminClientDetailsPage from "@/pages/admin-client-details";
import NotificationsPage from "@/pages/notifications";
import EnrollPage from "@/pages/enroll";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoading, isLoggedIn } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      setLocation("/login");
    }
  }, [isLoading, isLoggedIn, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return null;
  }

  return <Component />;
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { mockMode } = useAuth();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-3 border-b border-border bg-card/50">
            <SidebarTrigger data-testid="button-sidebar-toggle" className="text-foreground" />
            {mockMode && (
              <Badge variant="outline" className="text-xs text-secondary border-secondary/50">
                Mock Data Active
              </Badge>
            )}
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard">
        <AuthenticatedLayout>
          <ProtectedRoute component={DashboardPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/analytics">
        <AuthenticatedLayout>
          <ProtectedRoute component={AnalyticsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/members">
        <AuthenticatedLayout>
          <ProtectedRoute component={MembersPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/assets">
        <AuthenticatedLayout>
          <ProtectedRoute component={AssetsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/pos">
        <AuthenticatedLayout>
          <ProtectedRoute component={POSPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/admin/clients">
        <AuthenticatedLayout>
          <ProtectedRoute component={AdminClientsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/admin/clients/:userId">
        <AuthenticatedLayout>
          <ProtectedRoute component={AdminClientDetailsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/admin/campaigns">
        <AuthenticatedLayout>
          <ProtectedRoute component={CampaignsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/admin/notifications">
        <AuthenticatedLayout>
          <ProtectedRoute component={NotificationsPage} />
        </AuthenticatedLayout>
      </Route>
      <Route path="/enroll/:slug" component={EnrollPage} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <div className="dark">
            <Toaster />
            <Router />
          </div>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
