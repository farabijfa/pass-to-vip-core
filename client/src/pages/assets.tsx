import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink } from "lucide-react";
import QRCode from "qrcode";

export default function AssetsPage() {
  const { user, mockMode } = useAuth();
  const { toast } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const passkitEnrollmentUrl = user?.enrollmentUrl;
  const dashboardSlug = user?.dashboardSlug;
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const landingPageUrl = dashboardSlug ? `${appUrl}/enroll/${dashboardSlug}` : null;
  const qrCodeUrl = landingPageUrl || passkitEnrollmentUrl;

  useEffect(() => {
    async function generateQR() {
      if (!qrCodeUrl) {
        setIsGenerating(false);
        return;
      }

      try {
        setIsGenerating(true);

        const dataUrl = await QRCode.toDataURL(qrCodeUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrDataUrl(dataUrl);

        const svg = await QRCode.toString(qrCodeUrl, {
          type: "svg",
          width: 400,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#FFFFFF",
          },
        });
        setQrSvg(svg);
      } catch (error) {
        console.error("QR generation error:", error);
        toast({
          title: "Error",
          description: "Failed to generate QR code",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    }

    generateQR();
  }, [qrCodeUrl, toast]);

  const downloadPng = async () => {
    if (!qrCodeUrl) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 1024;

      await QRCode.toCanvas(canvas, qrCodeUrl, {
        width: 1024,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      const link = document.createElement("a");
      link.download = `${user?.programName?.replace(/[^a-z0-9]/gi, "_") || "enrollment"}_qr.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      toast({
        title: "Downloaded",
        description: "High-resolution PNG saved",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download PNG",
        variant: "destructive",
      });
    }
  };

  const downloadSvg = () => {
    if (!qrSvg) return;

    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${user?.programName?.replace(/[^a-z0-9]/gi, "_") || "enrollment"}_qr.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Vector SVG saved (perfect for print)",
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied",
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-assets-title">
            Program Assets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Download and share your enrollment materials
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      {!qrCodeUrl ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground" data-testid="text-no-enrollment-url">
              No enrollment URL configured for your program.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact support to set up your enrollment page.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Master Enrollment QR Code</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Display at your front desk for customers to scan
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {isGenerating ? (
                <Skeleton className="w-64 h-64 bg-muted" data-testid="skeleton-qr" />
              ) : qrDataUrl ? (
                <div className="bg-white p-4 rounded-lg shadow-sm" data-testid="container-qr">
                  <img
                    src={qrDataUrl}
                    alt="Enrollment QR Code"
                    className="w-64 h-64"
                    data-testid="img-qr-code"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                  <p className="text-muted-foreground text-sm">QR generation failed</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-6 justify-center">
                <Button
                  onClick={downloadPng}
                  disabled={!qrDataUrl}
                  data-testid="button-download-png"
                >
                  Download PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadSvg}
                  disabled={!qrSvg}
                  data-testid="button-download-svg"
                >
                  Download SVG
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mt-4 text-center">
                PNG: 1024x1024 for digital use
                <br />
                SVG: Vector format for print shops
              </p>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-foreground text-lg">Enrollment Links</CardTitle>
              <CardDescription className="text-muted-foreground text-sm">
                Copy links for Instagram, Facebook, or your website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {landingPageUrl && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                    Branded Landing Page
                  </label>
                  <div className="flex gap-2">
                    <code
                      className="flex-1 text-sm bg-muted p-3 rounded-md text-foreground break-all"
                      data-testid="text-landing-page-url"
                    >
                      {landingPageUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(landingPageUrl, "Landing page URL")}
                      data-testid="button-copy-landing-url"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    QR code points to this branded landing page
                  </p>
                </div>
              )}

              {passkitEnrollmentUrl && (
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                    Direct PassKit Enrollment
                  </label>
                  <div className="flex gap-2">
                    <code
                      className="flex-1 text-sm bg-muted p-3 rounded-md text-foreground break-all"
                      data-testid="text-passkit-url"
                    >
                      {passkitEnrollmentUrl}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(passkitEnrollmentUrl, "PassKit URL")}
                      data-testid="button-copy-passkit-url"
                    >
                      <CopyIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(passkitEnrollmentUrl, "_blank")}
                      data-testid="button-open-passkit-url"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Direct link to PassKit enrollment form
                  </p>
                </div>
              )}

              {!landingPageUrl && !passkitEnrollmentUrl && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">
                    No enrollment URLs configured
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-border">
                <h4 className="text-sm font-medium text-foreground mb-3">Quick Tips</h4>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li className="flex gap-2">
                    <span className="text-primary">1.</span>
                    Print the QR code and display it at your checkout counter
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">2.</span>
                    Add the link to your social media bio
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">3.</span>
                    Include in email receipts and newsletters
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">4.</span>
                    Add to your website footer or homepage
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}
