import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Program {
  id: string;
  name: string;
  protocol: string;
  enrollment_url?: string;
  is_suspended: boolean;
}

export default function EnrollPage() {
  const [, params] = useRoute("/enroll/:slug");
  const slug = params?.slug;
  
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getProtocolLabel = (protocol: string) => {
    switch (protocol) {
      case "MEMBERSHIP":
        return "Membership Rewards";
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
              Powered by Pass To Vip
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
