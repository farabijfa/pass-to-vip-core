import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CreditCard, 
  Smartphone, 
  Gift, 
  Ticket,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink
} from "lucide-react";

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

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case "MEMBERSHIP":
        return <CreditCard className="h-8 w-8" />;
      case "COUPON":
        return <Gift className="h-8 w-8" />;
      case "EVENT_TICKET":
        return <Ticket className="h-8 w-8" />;
      default:
        return <Smartphone className="h-8 w-8" />;
    }
  };

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
            <Skeleton className="h-12 w-12 rounded-full mx-auto mb-4" />
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
        <Card className="w-full max-w-md border-destructive/50">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Enrollment Unavailable
            </h2>
            <p className="text-muted-foreground" data-testid="text-error-message">
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
        <Card className="w-full max-w-md border-warning/50">
          <CardContent className="py-12 text-center">
            <XCircle className="h-12 w-12 text-warning mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Program Suspended
            </h2>
            <p className="text-muted-foreground">
              This program is currently suspended. Please contact the business for more information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-enrollment">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full text-primary">
            {getProtocolIcon(program.protocol)}
          </div>
          <CardTitle className="text-2xl" data-testid="text-program-name">
            {program.name}
          </CardTitle>
          <CardDescription>
            {getProtocolLabel(program.protocol)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="px-4 py-1">
              <CheckCircle className="h-3 w-3 mr-1" />
              Available Now
            </Badge>
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
                <Smartphone className="h-5 w-5 mr-2" />
                Add to Digital Wallet
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Works with Apple Wallet and Google Wallet
              </p>
            </div>
          ) : (
            <div className="text-center py-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Enrollment coming soon
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-border">
            <p className="text-xs text-center text-muted-foreground">
              Powered by PassToVIP Phygital Loyalty
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
