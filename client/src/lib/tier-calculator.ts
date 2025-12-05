/**
 * Tier Calculator Utility (Frontend)
 * 
 * Implements PassKit tier calculation logic according to the standard:
 * - Bronze: Entry-level tier (points ≤ tier_bronze_max)
 * - Silver: Mid-level tier (points ≤ tier_silver_max)
 * - Gold: High-level tier (points ≤ tier_gold_max)
 * - Platinum: Top-tier (points > tier_gold_max)
 */

export type TierLevel = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface TierThresholds {
  tierBronzeMax: number | null;
  tierSilverMax: number | null;
  tierGoldMax: number | null;
}

export interface TierInfo {
  level: TierLevel;
  name: string;
  nextTier: TierLevel | null;
  pointsToNextTier: number | null;
}

/**
 * Calculate the current tier level based on points and thresholds
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
 * Get human-readable tier name
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
 */
export function getTierInfo(
  points: number,
  thresholds: TierThresholds
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
    nextTier,
    pointsToNextTier: pointsToNextTier !== null && pointsToNextTier > 0 ? pointsToNextTier : null,
  };
}

/**
 * Get tier color for UI display (Tailwind classes)
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

/**
 * Get tier icon (Lucide icon name)
 */
export function getTierIcon(level: TierLevel): string {
  switch (level) {
    case 'BRONZE':
      return 'Medal';
    case 'SILVER':
      return 'Award';
    case 'GOLD':
      return 'Trophy';
    case 'PLATINUM':
      return 'Crown';
    default:
      return 'Star';
  }
}

/**
 * Format points with commas for display
 */
export function formatPoints(points: number): string {
  return points.toLocaleString();
}

/**
 * Calculate progress percentage to next tier
 */
export function getTierProgress(
  points: number,
  thresholds: TierThresholds
): number {
  const level = calculateTierLevel(points, thresholds);
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  
  let start = 0;
  let end = 0;
  
  switch (level) {
    case 'BRONZE':
      start = 0;
      end = tierBronzeMax || 1000;
      break;
    case 'SILVER':
      start = tierBronzeMax || 0;
      end = tierSilverMax || 5000;
      break;
    case 'GOLD':
      start = tierSilverMax || 0;
      end = tierGoldMax || 10000;
      break;
    case 'PLATINUM':
      // Already at top tier
      return 100;
  }
  
  if (end <= start) return 100;
  
  const progress = ((points - start) / (end - start)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
