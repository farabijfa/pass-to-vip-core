import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login, isLoading, mockMode } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const result = await login(email, password);
    
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Login failed");
    }
  };

  const handleMockLogin = async () => {
    setError("");
    const result = await login("demo@example.com", "demo123");
    if (result.success) {
      setLocation("/dashboard");
    } else {
      setError(result.error || "Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-semibold text-foreground tracking-tight">
            Pass To Vip
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-2">
            Sign in to access your loyalty program dashboard
          </CardDescription>
          {mockMode && (
            <Badge variant="outline" className="mt-3" data-testid="badge-mock-mode">
              Test Mode
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-password"
              />
            </div>
            
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md" data-testid="text-error">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {mockMode && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-sm text-muted-foreground text-center mb-3">
                Quick access with demo account
              </p>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleMockLogin}
                disabled={isLoading}
                data-testid="button-mock-login"
              >
                Demo Login
              </Button>
            </div>
          )}
          
          <div className="mt-6 pt-4 border-t border-border/50 text-center">
            <p className="text-[11px] text-muted-foreground leading-tight">
              Operated by Oakmont Logic LLC
            </p>
            <a 
              href="mailto:support@passtovip.com" 
              className="text-[11px] text-primary hover:underline"
              data-testid="link-login-support"
            >
              support@passtovip.com
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
