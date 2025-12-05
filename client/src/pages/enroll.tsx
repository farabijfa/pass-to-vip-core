import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Smartphone, CreditCard } from "lucide-react";

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
        return "VIP Membership";
      case "COUPON":
        return "Digital Coupon";
      case "EVENT_TICKET":
        return "Event Ticket";
      default:
        return "Digital Pass";
    }
  };

  const getProtocolDescription = (protocol: string) => {
    switch (protocol) {
      case "MEMBERSHIP":
        return "Join the VIP club and start earning rewards on every purchase. Your digital membership card works with Apple Wallet and Google Wallet.";
      case "COUPON":
        return "Claim your exclusive digital coupon and save on your next visit. Add it to your wallet for easy access.";
      case "EVENT_TICKET":
        return "Get your digital event ticket delivered straight to your phone. Quick and easy check-in at the venue.";
      default:
        return "Add this digital pass to your wallet for quick access.";
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case "MEMBERSHIP":
        return <CreditCard className="w-12 h-12 text-primary" />;
      case "COUPON":
        return <Wallet className="w-12 h-12 text-primary" />;
      case "EVENT_TICKET":
        return <Smartphone className="w-12 h-12 text-primary" />;
      default:
        return <Wallet className="w-12 h-12 text-primary" />;
    }
  };

  const handleGetPass = () => {
    if (program?.enrollment_url) {
      window.location.href = program.enrollment_url;
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
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
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
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
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

  if (!program.enrollment_url) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-border">
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              {getProtocolIcon(program.protocol)}
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {program.name}
            </h2>
            <p className="text-muted-foreground text-sm">
              Enrollment is being set up. Please check back soon.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md" data-testid="card-enrollment">
        <CardHeader className="text-center pb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {getProtocolIcon(program.protocol)}
          </div>
          <CardTitle className="text-2xl font-semibold tracking-tight" data-testid="text-program-name">
            {program.name}
          </CardTitle>
          <CardDescription className="text-sm font-medium text-primary">
            {getProtocolLabel(program.protocol)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            {getProtocolDescription(program.protocol)}
          </p>

          <Button 
            className="w-full" 
            size="lg"
            onClick={handleGetPass}
            data-testid="button-get-pass"
          >
            <Wallet className="w-4 h-4 mr-2" />
            Get Your Pass
          </Button>

          <div className="flex items-center justify-center gap-6 pt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.5 12.5c0-1.58-.875-2.95-2.148-3.65.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C9.828 2.644 8.867 2 7.786 2c-1.79 0-3.24 1.57-3.24 3.508 0 .328.045.645.127.943C3.096 6.834 2 8.34 2 10.08c0 2.098 1.612 3.878 3.72 4.02h.003c.062.518.284.938.604 1.276.602.634 1.502.954 2.486.854.924-.094 1.636-.51 2.066-1.102.198.01.396.01.594-.01.63-.054 1.17-.364 1.556-.84.234.298.532.556.874.756.56.33 1.212.526 1.95.606l-.001.01c.001.002.002.003.003.005 1.63 2.85.016 5.324-.016 5.37 0 0-.018.028-.024.04-.113.184-.196.41-.196.66 0 .625.475 1.135 1.065 1.175V24h.014c.632-.013 1.15-.49 1.2-1.102.003-.045.005-.09.005-.136 0-.09-.01-.173-.022-.255.295-.154.533-.447.607-.806.074-.365-.016-.73-.25-.996.196-.233.308-.542.276-.87-.03-.318-.188-.593-.427-.77l1.054-.925c.217-.19.32-.476.273-.757-.048-.28-.227-.518-.48-.632-.255-.113-.55-.087-.783.07-.33.225-.696.372-1.055.372l-.003.001c-1.093-.023-2.142-.604-2.142-1.773 0-.553.24-1.048.617-1.42.38-.37.89-.594 1.47-.594.53 0 1.01.186 1.38.494.336.28.706.486 1.08.6.15.044.31.066.47.066.55 0 1.06-.26 1.38-.702.34-.46.43-1.07.25-1.63-.09-.28-.25-.53-.46-.73.23-.09.47-.16.7-.27.35-.165.67-.39.96-.66.76-.71 1.19-1.69 1.19-2.76 0-1.5-.89-2.83-2.22-3.48-.03.01-.05.01-.08.02.05-.19.08-.39.08-.6 0-1.24-.96-2.24-2.15-2.24-.08 0-.16.01-.24.02.13-.38.2-.78.2-1.2z"/>
              </svg>
              <span>Apple Wallet</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span>Google Wallet</span>
            </div>
          </div>

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
