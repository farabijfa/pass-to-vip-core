import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wallet, CheckCircle } from "lucide-react";

interface Program {
  id: string;
  name: string;
  protocol: string;
  enrollment_url?: string;
  is_suspended: boolean;
}

interface EnrollmentResult {
  memberId: string;
  externalId?: string;
  isNewMember: boolean;
  redirectUrl: string;
  message: string;
}

export default function EnrollPage() {
  const [, params] = useRoute("/enroll/:slug");
  const slug = params?.slug;
  const { toast } = useToast();
  
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setError("Invalid enrollment link");
      setLoading(false);
      return;
    }

    async function fetchProgram() {
      try {
        const response = await fetch(`/api/enroll/${slug}`);
        const result = await response.json();
        
        if (!result.success) {
          setError(result.error?.message || "Program not found");
          return;
        }
        
        setProgram(result.data);
      } catch (err) {
        setError("Failed to load enrollment page");
      } finally {
        setLoading(false);
      }
    }

    fetchProgram();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields to continue.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/enroll/public", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dashboardSlug: slug,
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!result.success) {
        toast({
          title: "Enrollment Failed",
          description: result.error?.message || "Unable to complete enrollment. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const enrollmentData = result.data as EnrollmentResult;
      setEnrolled(true);
      setRedirectUrl(enrollmentData.redirectUrl);

      toast({
        title: enrollmentData.isNewMember ? "Welcome to the VIP Club!" : "Welcome Back!",
        description: enrollmentData.message,
      });

      setTimeout(() => {
        if (enrollmentData.redirectUrl) {
          window.location.href = enrollmentData.redirectUrl;
        }
      }, 2000);

    } catch (err) {
      toast({
        title: "Network Error",
        description: "Unable to connect to the server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getProtocolLabel = (protocol: string) => {
    switch (protocol) {
      case "MEMBERSHIP":
        return "VIP Membership";
      case "COUPON":
        return "Digital Coupon";
      case "EVENT_TICKET":
        return "Event Ticket";
      default:
        return "Digital Pass";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-6 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-32 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Enrollment Unavailable
            </h2>
            <p className="text-muted-foreground text-sm" data-testid="text-error-message">
              {error || "This enrollment link is not valid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (program.is_suspended) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Program Suspended
            </h2>
            <p className="text-muted-foreground text-sm">
              This program is currently suspended. Please contact the business for more information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (enrolled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="card-enrollment-success">
          <CardContent className="py-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              You're In!
            </h2>
            <p className="text-muted-foreground text-sm">
              Redirecting you to download your digital pass...
            </p>
            {redirectUrl && (
              <Button 
                variant="outline" 
                onClick={() => window.location.href = redirectUrl}
                data-testid="button-redirect-manual"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Open Pass Now
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (program.protocol === "MEMBERSHIP") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md" data-testid="card-enrollment">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-semibold tracking-tight" data-testid="text-program-name">
              Join {program.name}
            </CardTitle>
            <CardDescription className="text-sm">
              {getProtocolLabel(program.protocol)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={submitting}
                  required
                  data-testid="input-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={submitting}
                  required
                  data-testid="input-last-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={submitting}
                  required
                  data-testid="input-email"
                />
                <p className="text-xs text-muted-foreground">
                  We'll use this to send your digital pass
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={submitting}
                data-testid="button-join"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Join VIP Club
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground pt-2">
                By joining, you agree to receive updates about exclusive offers and rewards.
              </p>
            </form>

            <div className="pt-6 border-t border-border mt-6">
              <p className="text-xs text-center text-muted-foreground">
                Works with Apple Wallet & Google Wallet
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-enrollment">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-semibold tracking-tight" data-testid="text-program-name">
            {program.name}
          </CardTitle>
          <CardDescription className="text-sm">
            {getProtocolLabel(program.protocol)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <span className="text-sm text-foreground">Available Now</span>
            <p className="text-sm text-muted-foreground">
              Add this {getProtocolLabel(program.protocol).toLowerCase()} to your digital wallet
            </p>
          </div>

          {program.enrollment_url ? (
            <div className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                onClick={() => window.open(program.enrollment_url, "_blank")}
                data-testid="button-add-to-wallet"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Add to Digital Wallet
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Works with Apple Wallet and Google Wallet
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                Enrollment coming soon
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Powered by Pass To VIP
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
