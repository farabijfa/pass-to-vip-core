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

const menuItems = [
  { title: "Dashboard", path: "/dashboard", testId: "link-dashboard" },
  { title: "Analytics", path: "/analytics", testId: "link-analytics" },
  { title: "Members", path: "/members", testId: "link-members" },
  { title: "POS Simulator", path: "/pos", testId: "link-pos" },
];

const adminItems = [
  { title: "Client Management", path: "/admin/clients", testId: "link-admin-clients" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, mockMode, logout, isAdmin } = useAuth();

  return (
    <Sidebar className="border-border">
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex flex-col">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">
            Pass To Vip
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Loyalty Platform
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" className="mt-3 w-full justify-center text-xs" data-testid="badge-sidebar-mock">
            Test Mode
          </Badge>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Menu
          </SidebarGroupLabel>
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
            <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
              Administration
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
          <div className="mb-3 p-3 rounded-md bg-muted/50">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-program">
              {user.programName}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {user.role}
            </p>
          </div>
        )}
        <Button 
          variant="outline" 
          className="w-full"
          onClick={logout}
          data-testid="button-logout"
        >
          Sign Out
        </Button>
        <div className="mt-4 pt-3 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground leading-tight">
            Operated by Oakmont Logic LLC
          </p>
          <a 
            href="mailto:support@passtovip.com" 
            className="text-[10px] text-primary hover:underline"
            data-testid="link-support-email"
          >
            support@passtovip.com
          </a>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
