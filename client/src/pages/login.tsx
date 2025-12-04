import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogIn, Sparkles } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted to-background p-4">
      <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl text-foreground">Client Portal</CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in to access your loyalty program dashboard
          </CardDescription>
          {mockMode && (
            <Badge variant="secondary" className="mt-2" data-testid="badge-mock-mode">
              Mock Mode Active
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@business.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-password"
              />
            </div>
            
            {error && (
              <div className="text-sm text-destructive-foreground bg-destructive/20 p-3 rounded-md" data-testid="text-error">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Sign In
                </>
              )}
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
                <Sparkles className="mr-2 h-4 w-4" />
                Demo Login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
