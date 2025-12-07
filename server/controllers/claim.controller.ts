import type { Request, Response, NextFunction } from "express";
import { supabaseService, passKitService } from "../services";
import type { ApiResponse } from "@shared/schema";
import { generate } from "short-uuid";
import { calculateTierLevel, getTierPasskitId, getTierName, type TierLevel } from "../utils/tier-calculator";

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

      // Fetch program config to get tier thresholds and tier IDs
      const programResult = await supabaseService.getProgramByPasskitId(claim.passkitProgramId);
      
      // Calculate the appropriate tier based on points (new members start at 0 = Bronze)
      const startingPoints = 0;
      let tierId: string | undefined = undefined;
      let tierLevel: TierLevel = "TIER_1";
      
      if (programResult.success && programResult.program) {
        const program = programResult.program;
        
        // Calculate tier level based on points and thresholds
        tierLevel = calculateTierLevel(startingPoints, {
          tierBronzeMax: program.tierBronzeMax,
          tierSilverMax: program.tierSilverMax,
          tierGoldMax: program.tierGoldMax,
        });
        
        // Get the appropriate PassKit tier ID for this level
        const resolvedTierId = getTierPasskitId(tierLevel, {
          passkitTierBronzeId: program.passkitTierBronzeId,
          passkitTierSilverId: program.passkitTierSilverId,
          passkitTierGoldId: program.passkitTierGoldId,
          passkitTierPlatinumId: program.passkitTierPlatinumId,
          passkitTierId: program.passkitTierId,
        });
        
        // Only use tierId if it's a real PassKit ID, not the fallback "base"
        if (resolvedTierId && resolvedTierId !== "base") {
          tierId = resolvedTierId;
        }
      }

      // Try to get a tier from PassKit if none is configured in the database
      // Some programs (like GIFT CARDS / money-balance) may not require tiers
      if (!tierId) {
        console.log(`📋 No tier configured in database, attempting to fetch default tier from PassKit...`);
        const defaultTierResult = await passKitService.getOrCreateDefaultTier(claim.passkitProgramId);
        
        if (defaultTierResult.success && defaultTierResult.tierId) {
          tierId = defaultTierResult.tierId;
          console.log(`📋 Using default tier from PassKit: ${tierId}`);
        } else {
          // No tier available - proceed without tierId (some programs like GIFT CARDS don't require tiers)
          console.log(`⚠️ No tier available for program ${claim.passkitProgramId}. Attempting enrollment without tierId...`);
          console.log(`   Reason: ${defaultTierResult.error}`);
          // tierId remains undefined - PassKit API will handle it based on program type
        }
      } else {
        console.log(`📋 Using tier: ${getTierName(tierLevel)} (ID: ${tierId}) for program: ${claim.passkitProgramId}`);
      }

      const enrollResult = await passKitService.enrollMember(
        claim.passkitProgramId,
        {
          email: claim.email || `${claimCode}@claim.local`,
          firstName: claim.firstName || "Guest",
          lastName: claim.lastName,
          points: startingPoints,
          tierId,
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
