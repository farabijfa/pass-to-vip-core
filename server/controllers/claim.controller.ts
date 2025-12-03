import type { Request, Response, NextFunction } from "express";
import { supabaseService, passKitService } from "../services";
import type { ApiResponse } from "@shared/schema";
import { generate } from "short-uuid";

function createResponse<T>(
  success: boolean,
  data?: T,
  error?: { code: string; message: string; details?: any },
  requestId?: string
): ApiResponse<T> {
  return {
    success,
    data,
    error,
    metadata: {
      requestId: requestId || generate(),
      timestamp: new Date().toISOString(),
    },
  };
}

export class ClaimController {
  async handleClaim(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const { id: claimCode } = req.params;

    console.log(`🔍 Looking up claim code: ${claimCode}`);

    try {
      const result = await supabaseService.lookupClaimCode(claimCode);

      if (!result.success || !result.claimCode) {
        console.log(`❌ Claim code not found: ${claimCode}`);
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "CLAIM_NOT_FOUND",
              message: "This claim code was not found or has expired",
            },
            requestId
          )
        );
      }

      const claim = result.claimCode;

      if (claim.status === "INSTALLED") {
        console.log(`⚠️ Claim code already used: ${claimCode}`);
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "CLAIM_ALREADY_USED",
              message: "This pass has already been added to a wallet",
            },
            requestId
          )
        );
      }

      if (claim.status === "EXPIRED" || claim.status === "CANCELLED") {
        console.log(`⚠️ Claim code expired/cancelled: ${claimCode}`);
        return res.status(400).json(
          createResponse(
            false,
            undefined,
            {
              code: "CLAIM_EXPIRED",
              message: "This claim code has expired or been cancelled",
            },
            requestId
          )
        );
      }

      if (claim.passkitInstallUrl) {
        console.log(`✅ Redirecting to existing install URL: ${claim.passkitInstallUrl}`);
        return res.redirect(claim.passkitInstallUrl);
      }

      console.log(`🎫 Enrolling new member in PassKit program: ${claim.passkitProgramId}`);

      const enrollResult = await passKitService.enrollMember(
        claim.passkitProgramId,
        {
          email: claim.email || `${claimCode}@claim.local`,
          firstName: claim.firstName || "Guest",
          lastName: claim.lastName,
          points: 0,
        }
      );

      if (!enrollResult.success || !enrollResult.install_url) {
        console.error(`❌ PassKit enrollment failed for claim: ${claimCode}`);
        return res.status(500).json(
          createResponse(
            false,
            undefined,
            {
              code: "ENROLLMENT_FAILED",
              message: "Failed to create your digital pass. Please try again.",
              details: enrollResult.error,
            },
            requestId
          )
        );
      }

      await supabaseService.updateClaimCodeStatus(
        claimCode,
        "INSTALLED",
        enrollResult.install_url
      );

      console.log(`✅ Claim successful, redirecting to: ${enrollResult.install_url}`);
      
      return res.redirect(enrollResult.install_url);

    } catch (error) {
      console.error("Claim processing error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred while processing your claim",
          },
          requestId
        )
      );
    }
  }

  async getClaimStatus(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers["x-request-id"] as string) || generate();
    const { id: claimCode } = req.params;

    try {
      const result = await supabaseService.lookupClaimCode(claimCode);

      if (!result.success || !result.claimCode) {
        return res.status(404).json(
          createResponse(
            false,
            undefined,
            {
              code: "CLAIM_NOT_FOUND",
              message: "Claim code not found",
            },
            requestId
          )
        );
      }

      return res.status(200).json(
        createResponse(
          true,
          {
            claimCode: result.claimCode.claimCode,
            status: result.claimCode.status,
            firstName: result.claimCode.firstName,
            createdAt: result.claimCode.createdAt,
            installedAt: result.claimCode.installedAt,
          },
          undefined,
          requestId
        )
      );
    } catch (error) {
      console.error("Get claim status error:", error);
      return res.status(500).json(
        createResponse(
          false,
          undefined,
          {
            code: "INTERNAL_ERROR",
            message: "An unexpected error occurred",
          },
          requestId
        )
      );
    }
  }
}

export const claimController = new ClaimController();
