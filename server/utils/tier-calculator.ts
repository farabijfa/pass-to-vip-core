/**
 * Tier Calculator Utility
 * 
 * Implements PassKit tier calculation logic with dynamic tier naming.
 * Supports multiple naming presets for different use cases:
 * - LOYALTY: Bronze, Silver, Gold, Platinum
 * - OFFICE: Member, Staff, Admin, Executive
 * - GYM: Weekday, 7-Day, 24/7, Family
 * - CUSTOM: User-defined tier names
 * - NONE: No tier progression, just a single member label
 * 
 * When member points cross tier thresholds, the appropriate tier ID
 * is used to display different PassKit visual templates.
 */

export type TierLevel = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';

export type TierSystemType = 'LOYALTY' | 'OFFICE' | 'GYM' | 'CUSTOM' | 'NONE';

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
  passkitTierId: string | null;
}

export interface TierNames {
  tier1Name: string;
  tier2Name: string;
  tier3Name: string;
  tier4Name: string;
  defaultMemberLabel: string;
}

export interface TierInfo {
  level: TierLevel;
  name: string;
  passkitTierId: string | null;
  nextTier: TierLevel | null;
  nextTierName: string | null;
  pointsToNextTier: number | null;
}

export interface TierConfig {
  tierSystemType: TierSystemType;
  thresholds: TierThresholds;
  tierIds: TierIds;
  tierNames: TierNames;
}

export const TIER_PRESETS: Record<TierSystemType, Omit<TierNames, 'defaultMemberLabel'> & { defaultMemberLabel: string }> = {
  LOYALTY: {
    tier1Name: 'Bronze',
    tier2Name: 'Silver',
    tier3Name: 'Gold',
    tier4Name: 'Platinum',
    defaultMemberLabel: 'Member',
  },
  OFFICE: {
    tier1Name: 'Member',
    tier2Name: 'Staff',
    tier3Name: 'Admin',
    tier4Name: 'Executive',
    defaultMemberLabel: 'Member',
  },
  GYM: {
    tier1Name: 'Weekday',
    tier2Name: '7-Day',
    tier3Name: '24/7',
    tier4Name: 'Family',
    defaultMemberLabel: 'Member',
  },
  CUSTOM: {
    tier1Name: 'Tier 1',
    tier2Name: 'Tier 2',
    tier3Name: 'Tier 3',
    tier4Name: 'Tier 4',
    defaultMemberLabel: 'Member',
  },
  NONE: {
    tier1Name: 'Member',
    tier2Name: 'Member',
    tier3Name: 'Member',
    tier4Name: 'Member',
    defaultMemberLabel: 'Member',
  },
};

export function getPresetTierNames(systemType: TierSystemType): TierNames {
  return TIER_PRESETS[systemType] || TIER_PRESETS.LOYALTY;
}

export function calculateTierLevel(
  points: number,
  thresholds: TierThresholds
): TierLevel {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  
  if (!tierBronzeMax && !tierSilverMax && !tierGoldMax) {
    return 'TIER_1';
  }

  if (tierBronzeMax !== null && points <= tierBronzeMax) {
    return 'TIER_1';
  }
  
  if (tierSilverMax !== null && points <= tierSilverMax) {
    return 'TIER_2';
  }
  
  if (tierGoldMax !== null && points <= tierGoldMax) {
    return 'TIER_3';
  }
  
  return 'TIER_4';
}

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
  
  const baseTierId = passkitTierId || 'base';
  
  switch (level) {
    case 'TIER_1':
      return passkitTierBronzeId || baseTierId;
    case 'TIER_2':
      return passkitTierSilverId || baseTierId;
    case 'TIER_3':
      return passkitTierGoldId || baseTierId;
    case 'TIER_4':
      return passkitTierPlatinumId || baseTierId;
    default:
      return baseTierId;
  }
}

export function getTierNameFromLevel(
  level: TierLevel,
  tierNames: TierNames,
  tierSystemType: TierSystemType = 'LOYALTY'
): string {
  if (tierSystemType === 'NONE') {
    return tierNames.defaultMemberLabel || 'Member';
  }

  switch (level) {
    case 'TIER_1':
      return tierNames.tier1Name || 'Bronze';
    case 'TIER_2':
      return tierNames.tier2Name || 'Silver';
    case 'TIER_3':
      return tierNames.tier3Name || 'Gold';
    case 'TIER_4':
      return tierNames.tier4Name || 'Platinum';
    default:
      return tierNames.defaultMemberLabel || 'Member';
  }
}

export function getTierName(level: TierLevel | string, tierNames?: TierNames): string {
  const names = tierNames || TIER_PRESETS.LOYALTY;
  
  const levelMap: Record<string, TierLevel> = {
    'BRONZE': 'TIER_1',
    'SILVER': 'TIER_2',
    'GOLD': 'TIER_3',
    'PLATINUM': 'TIER_4',
    'TIER_1': 'TIER_1',
    'TIER_2': 'TIER_2',
    'TIER_3': 'TIER_3',
    'TIER_4': 'TIER_4',
  };
  
  const normalizedLevel = levelMap[level] || 'TIER_1';
  return getTierNameFromLevel(normalizedLevel, names);
}

export function getLegacyTierLevel(level: TierLevel): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  switch (level) {
    case 'TIER_1': return 'BRONZE';
    case 'TIER_2': return 'SILVER';
    case 'TIER_3': return 'GOLD';
    case 'TIER_4': return 'PLATINUM';
    default: return 'BRONZE';
  }
}

export function fromLegacyTierLevel(level: string): TierLevel {
  switch (level) {
    case 'BRONZE': return 'TIER_1';
    case 'SILVER': return 'TIER_2';
    case 'GOLD': return 'TIER_3';
    case 'PLATINUM': return 'TIER_4';
    default: return 'TIER_1';
  }
}

export function getTierInfo(
  points: number,
  thresholds: TierThresholds,
  tierIds: TierIds,
  tierNames?: TierNames,
  tierSystemType: TierSystemType = 'LOYALTY'
): TierInfo {
  const level = calculateTierLevel(points, thresholds);
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  const names = tierNames || TIER_PRESETS[tierSystemType];
  
  let nextTier: TierLevel | null = null;
  let nextTierName: string | null = null;
  let pointsToNextTier: number | null = null;
  
  if (tierSystemType !== 'NONE') {
    switch (level) {
      case 'TIER_1':
        if (tierBronzeMax !== null) {
          nextTier = 'TIER_2';
          nextTierName = names.tier2Name;
          pointsToNextTier = tierBronzeMax - points + 1;
        }
        break;
      case 'TIER_2':
        if (tierSilverMax !== null) {
          nextTier = 'TIER_3';
          nextTierName = names.tier3Name;
          pointsToNextTier = tierSilverMax - points + 1;
        }
        break;
      case 'TIER_3':
        if (tierGoldMax !== null) {
          nextTier = 'TIER_4';
          nextTierName = names.tier4Name;
          pointsToNextTier = tierGoldMax - points + 1;
        }
        break;
      case 'TIER_4':
        nextTier = null;
        nextTierName = null;
        pointsToNextTier = null;
        break;
    }
  }
  
  return {
    level,
    name: getTierNameFromLevel(level, names, tierSystemType),
    passkitTierId: getTierPasskitId(level, tierIds),
    nextTier,
    nextTierName,
    pointsToNextTier: pointsToNextTier !== null && pointsToNextTier > 0 ? pointsToNextTier : null,
  };
}

export function checkTierUpgrade(
  currentPoints: number,
  newPoints: number,
  thresholds: TierThresholds,
  tierNames?: TierNames,
  tierSystemType: TierSystemType = 'LOYALTY'
): { upgraded: boolean; oldTier: TierLevel; newTier: TierLevel; oldTierName: string; newTierName: string } {
  const oldTier = calculateTierLevel(currentPoints, thresholds);
  const newTier = calculateTierLevel(newPoints, thresholds);
  const names = tierNames || TIER_PRESETS[tierSystemType];
  
  const tierOrder: TierLevel[] = ['TIER_1', 'TIER_2', 'TIER_3', 'TIER_4'];
  const upgraded = tierOrder.indexOf(newTier) > tierOrder.indexOf(oldTier);
  
  return {
    upgraded,
    oldTier,
    newTier,
    oldTierName: getTierNameFromLevel(oldTier, names, tierSystemType),
    newTierName: getTierNameFromLevel(newTier, names, tierSystemType),
  };
}

export function getTierColor(level: TierLevel | string): { bg: string; text: string; border: string } {
  const levelMap: Record<string, TierLevel> = {
    'BRONZE': 'TIER_1',
    'SILVER': 'TIER_2',
    'GOLD': 'TIER_3',
    'PLATINUM': 'TIER_4',
    'TIER_1': 'TIER_1',
    'TIER_2': 'TIER_2',
    'TIER_3': 'TIER_3',
    'TIER_4': 'TIER_4',
  };
  
  const normalizedLevel = levelMap[level] || 'TIER_1';
  
  switch (normalizedLevel) {
    case 'TIER_1':
      return {
        bg: 'bg-amber-700',
        text: 'text-amber-100',
        border: 'border-amber-600',
      };
    case 'TIER_2':
      return {
        bg: 'bg-gray-400',
        text: 'text-gray-900',
        border: 'border-gray-500',
      };
    case 'TIER_3':
      return {
        bg: 'bg-yellow-500',
        text: 'text-yellow-900',
        border: 'border-yellow-600',
      };
    case 'TIER_4':
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

export function buildTierConfig(program: {
  tier_system_type?: string | null;
  tier_1_name?: string | null;
  tier_2_name?: string | null;
  tier_3_name?: string | null;
  tier_4_name?: string | null;
  default_member_label?: string | null;
  tier_bronze_max?: number | null;
  tier_silver_max?: number | null;
  tier_gold_max?: number | null;
  passkit_tier_id?: string | null;
  passkit_tier_bronze_id?: string | null;
  passkit_tier_silver_id?: string | null;
  passkit_tier_gold_id?: string | null;
  passkit_tier_platinum_id?: string | null;
}): TierConfig {
  const tierSystemType = (program.tier_system_type as TierSystemType) || 'LOYALTY';
  const preset = TIER_PRESETS[tierSystemType];
  
  return {
    tierSystemType,
    thresholds: {
      tierBronzeMax: program.tier_bronze_max ?? null,
      tierSilverMax: program.tier_silver_max ?? null,
      tierGoldMax: program.tier_gold_max ?? null,
    },
    tierIds: {
      passkitTierId: program.passkit_tier_id ?? null,
      passkitTierBronzeId: program.passkit_tier_bronze_id ?? null,
      passkitTierSilverId: program.passkit_tier_silver_id ?? null,
      passkitTierGoldId: program.passkit_tier_gold_id ?? null,
      passkitTierPlatinumId: program.passkit_tier_platinum_id ?? null,
    },
    tierNames: {
      tier1Name: program.tier_1_name || preset.tier1Name,
      tier2Name: program.tier_2_name || preset.tier2Name,
      tier3Name: program.tier_3_name || preset.tier3Name,
      tier4Name: program.tier_4_name || preset.tier4Name,
      defaultMemberLabel: program.default_member_label || preset.defaultMemberLabel,
    },
  };
}
