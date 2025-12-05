import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  CreditCard, 
  LogOut,
  Sparkles,
  User,
  Building2,
  Settings
} from "lucide-react";

const menuItems = [
  { title: "Dashboard", path: "/dashboard", icon: LayoutDashboard, testId: "link-dashboard" },
  { title: "Analytics", path: "/analytics", icon: BarChart3, testId: "link-analytics" },
  { title: "Members", path: "/members", icon: Users, testId: "link-members" },
  { title: "POS Simulator", path: "/pos", icon: CreditCard, testId: "link-pos" },
];

const adminItems = [
  { title: "Client Management", path: "/admin/clients", icon: Building2, testId: "link-admin-clients" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, mockMode, logout, isAdmin } = useAuth();

  return (
    <Sidebar className="border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Client Portal</h2>
            <p className="text-xs text-muted-foreground">Phygital Loyalty</p>
          </div>
        </div>
        {mockMode && (
          <Badge variant="secondary" className="mt-2 w-full justify-center" data-testid="badge-sidebar-mock">
            Mock Mode
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild
                    isActive={location === item.path}
                    data-testid={item.testId}
                  >
                    <Link href={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Admin
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton 
                      asChild
                      isActive={location === item.path}
                      data-testid={item.testId}
                    >
                      <Link href={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-4">
        {user && (
          <div className="mb-3 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-program">
                  {user.programName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.role}
                </p>
              </div>
            </div>
          </div>
        )}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
