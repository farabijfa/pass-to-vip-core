/**
 * Tier Calculator Utility
 * 
 * Implements PassKit tier calculation logic according to the standard:
 * - Bronze: Entry-level tier (points ≤ tier_bronze_max)
 * - Silver: Mid-level tier (points ≤ tier_silver_max)
 * - Gold: High-level tier (points ≤ tier_gold_max)
 * - Platinum: Top-tier (points > tier_gold_max)
 * 
 * When member points cross tier thresholds, the appropriate tier ID
 * is used to display different PassKit visual templates.
 */

export type TierLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface TierThresholds {
  tierBronzeMax: number | null;
  tierSilverMax: number | null;
  tierGoldMax: number | null;
}

export interface TierIds {
  passkitTierBronzeId: string | null;
  passkitTierSilverId: string | null;
  passkitTierGoldId: string | null;
  passkitTierPlatinumId: string | null;
  passkitTierId: string | null; // Base/default tier ID
}

export interface TierInfo {
  level: TierLevel;
  name: string;
  passkitTierId: string | null;
  nextTier: TierLevel | null;
  pointsToNextTier: number | null;
}

/**
 * Calculate the current tier level based on points and thresholds
 * 
 * @param points - Current member points balance
 * @param thresholds - Program tier thresholds (Bronze/Silver/Gold max)
 * @returns The tier level (BRONZE, SILVER, GOLD, or PLATINUM)
 */
export function calculateTierLevel(
  points: number,
  thresholds: TierThresholds
): TierLevel {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  
  // If no thresholds configured, default to BRONZE
  if (!tierBronzeMax && !tierSilverMax && !tierGoldMax) {
    return 'BRONZE';
  }

  // Check tiers from bottom to top
  if (tierBronzeMax !== null && points <= tierBronzeMax) {
    return 'BRONZE';
  }
  
  if (tierSilverMax !== null && points <= tierSilverMax) {
    return 'SILVER';
  }
  
  if (tierGoldMax !== null && points <= tierGoldMax) {
    return 'GOLD';
  }
  
  // Above all thresholds = PLATINUM
  return 'PLATINUM';
}

/**
 * Get the PassKit tier ID for a given tier level
 * Falls back to base tier ID if specific tier ID not configured
 * 
 * @param level - The tier level
 * @param tierIds - Object containing all tier IDs
 * @returns The appropriate PassKit tier ID
 */
export function getTierPasskitId(
  level: TierLevel,
  tierIds: TierIds
): string {
  const {
    passkitTierBronzeId,
    passkitTierSilverId,
    passkitTierGoldId,
    passkitTierPlatinumId,
    passkitTierId
  } = tierIds;
  
  // Default/fallback tier ID
  const baseTierId = passkitTierId || 'base';
  
  switch (level) {
    case 'BRONZE':
      return passkitTierBronzeId || baseTierId;
    case 'SILVER':
      return passkitTierSilverId || baseTierId;
    case 'GOLD':
      return passkitTierGoldId || baseTierId;
    case 'PLATINUM':
      return passkitTierPlatinumId || baseTierId;
    default:
      return baseTierId;
  }
}

/**
 * Get human-readable tier name
 * 
 * @param level - The tier level
 * @returns Human-readable tier name
 */
export function getTierName(level: TierLevel): string {
  switch (level) {
    case 'BRONZE':
      return 'Bronze';
    case 'SILVER':
      return 'Silver';
    case 'GOLD':
      return 'Gold';
    case 'PLATINUM':
      return 'Platinum';
    default:
      return 'Member';
  }
}

/**
 * Get complete tier information including next tier and points needed
 * 
 * @param points - Current member points balance
 * @param thresholds - Program tier thresholds
 * @param tierIds - Object containing all tier IDs
 * @returns Complete tier information
 */
export function getTierInfo(
  points: number,
  thresholds: TierThresholds,
  tierIds: TierIds
): TierInfo {
  const level = calculateTierLevel(points, thresholds);
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  
  let nextTier: TierLevel | null = null;
  let pointsToNextTier: number | null = null;
  
  switch (level) {
    case 'BRONZE':
      if (tierBronzeMax !== null) {
        nextTier = 'SILVER';
        pointsToNextTier = tierBronzeMax - points + 1;
      }
      break;
    case 'SILVER':
      if (tierSilverMax !== null) {
        nextTier = 'GOLD';
        pointsToNextTier = tierSilverMax - points + 1;
      }
      break;
    case 'GOLD':
      if (tierGoldMax !== null) {
        nextTier = 'PLATINUM';
        pointsToNextTier = tierGoldMax - points + 1;
      }
      break;
    case 'PLATINUM':
      // Platinum is the top tier
      nextTier = null;
      pointsToNextTier = null;
      break;
  }
  
  return {
    level,
    name: getTierName(level),
    passkitTierId: getTierPasskitId(level, tierIds),
    nextTier,
    pointsToNextTier: pointsToNextTier !== null && pointsToNextTier > 0 ? pointsToNextTier : null,
  };
}

/**
 * Check if a member would upgrade to a new tier after earning points
 * 
 * @param currentPoints - Current points before earning
 * @param newPoints - New points after earning
 * @param thresholds - Program tier thresholds
 * @returns Object indicating if tier changed and the new tier
 */
export function checkTierUpgrade(
  currentPoints: number,
  newPoints: number,
  thresholds: TierThresholds
): { upgraded: boolean; oldTier: TierLevel; newTier: TierLevel } {
  const oldTier = calculateTierLevel(currentPoints, thresholds);
  const newTier = calculateTierLevel(newPoints, thresholds);
  
  const tierOrder: TierLevel[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
  const upgraded = tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);
  
  return {
    upgraded,
    oldTier,
    newTier,
  };
}

/**
 * Get tier color for UI display
 * 
 * @param level - The tier level
 * @returns CSS color class or hex color
 */
export function getTierColor(level: TierLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'BRONZE':
      return {
        bg: 'bg-amber-700',
        text: 'text-amber-100',
        border: 'border-amber-600',
      };
    case 'SILVER':
      return {
        bg: 'bg-gray-400',
        text: 'text-gray-900',
        border: 'border-gray-500',
      };
    case 'GOLD':
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-900',
        border: 'border-yellow-600',
      };
    case 'PLATINUM':
      return {
        bg: 'bg-slate-800',
        text: 'text-slate-100',
        border: 'border-slate-600',
      };
    default:
      return {
        bg: 'bg-gray-200',
        text: 'text-gray-800',
        border: 'border-gray-300',
      };
  }
}
