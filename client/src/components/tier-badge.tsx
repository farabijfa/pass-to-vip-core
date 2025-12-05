import { Badge } from "@/components/ui/badge";
import { Medal, Award, Trophy, Crown, Star } from "lucide-react";
import { 
  type TierLevel, 
  type TierNames,
  type TierSystemType,
  getTierName, 
  getTierColor,
  getTierNameFromLevel,
  TIER_PRESETS,
  fromLegacyTierLevel
} from "@/lib/tier-calculator";

interface TierBadgeProps {
  level: TierLevel | string;
  tierNames?: TierNames;
  tierSystemType?: TierSystemType;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const tierIcons: Record<TierLevel, typeof Medal> = {
  TIER_1: Medal,
  TIER_2: Award,
  TIER_3: Trophy,
  TIER_4: Crown,
};

const sizeClasses = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-2.5 py-0.5",
  lg: "text-base px-3 py-1",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

function normalizeLevel(level: TierLevel | string): TierLevel {
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
  return levelMap[level] || 'TIER_1';
}

export function TierBadge({ 
  level, 
  tierNames,
  tierSystemType = 'LOYALTY',
  showIcon = true, 
  size = "md", 
  className = "" 
}: TierBadgeProps) {
  const normalizedLevel = normalizeLevel(level);
  const { bg, text, border } = getTierColor(normalizedLevel);
  const Icon = tierIcons[normalizedLevel] || Star;
  const names = tierNames || TIER_PRESETS[tierSystemType];
  const name = getTierNameFromLevel(normalizedLevel, names, tierSystemType);

  return (
    <Badge
      data-testid={`badge-tier-${normalizedLevel.toLowerCase()}`}
      className={`${bg} ${text} ${border} border ${sizeClasses[size]} ${className}`}
    >
      {showIcon && <Icon className={`${iconSizes[size]} mr-1`} />}
      {name}
    </Badge>
  );
}

interface TierProgressProps {
  points: number;
  thresholds: {
    tierBronzeMax: number | null;
    tierSilverMax: number | null;
    tierGoldMax: number | null;
  };
  tierNames?: TierNames;
  tierSystemType?: TierSystemType;
  showDetails?: boolean;
}

export function TierProgress({ 
  points, 
  thresholds, 
  tierNames,
  tierSystemType = 'LOYALTY',
  showDetails = true 
}: TierProgressProps) {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  const names = tierNames || TIER_PRESETS[tierSystemType];

  const calculateProgress = (): { 
    level: TierLevel; 
    progress: number; 
    nextThreshold: number | null; 
    pointsNeeded: number | null;
    nextTierName: string | null;
  } => {
    if (!tierBronzeMax && !tierSilverMax && !tierGoldMax) {
      return { level: "TIER_1", progress: 100, nextThreshold: null, pointsNeeded: null, nextTierName: null };
    }

    if (tierBronzeMax !== null && points <= tierBronzeMax) {
      const progress = (points / tierBronzeMax) * 100;
      return { 
        level: "TIER_1", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierBronzeMax + 1,
        pointsNeeded: tierBronzeMax - points + 1,
        nextTierName: names.tier2Name
      };
    }

    if (tierSilverMax !== null && points <= tierSilverMax) {
      const start = tierBronzeMax || 0;
      const range = tierSilverMax - start;
      const progress = ((points - start) / range) * 100;
      return { 
        level: "TIER_2", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierSilverMax + 1,
        pointsNeeded: tierSilverMax - points + 1,
        nextTierName: names.tier3Name
      };
    }

    if (tierGoldMax !== null && points <= tierGoldMax) {
      const start = tierSilverMax || 0;
      const range = tierGoldMax - start;
      const progress = ((points - start) / range) * 100;
      return { 
        level: "TIER_3", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierGoldMax + 1,
        pointsNeeded: tierGoldMax - points + 1,
        nextTierName: names.tier4Name
      };
    }

    return { level: "TIER_4", progress: 100, nextThreshold: null, pointsNeeded: null, nextTierName: null };
  };

  const { level, progress, pointsNeeded, nextTierName } = calculateProgress();
  const { bg } = getTierColor(level);

  return (
    <div className="space-y-2" data-testid="tier-progress">
      <div className="flex items-center justify-between">
        <TierBadge level={level} tierNames={tierNames} tierSystemType={tierSystemType} size="sm" />
        {showDetails && pointsNeeded !== null && nextTierName !== null && (
          <span className="text-xs text-muted-foreground">
            {pointsNeeded.toLocaleString()} pts to {nextTierName}
          </span>
        )}
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${bg} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

interface TierInfoCardProps {
  points: number;
  thresholds: {
    tierBronzeMax: number | null;
    tierSilverMax: number | null;
    tierGoldMax: number | null;
  };
  tierNames?: TierNames;
  tierSystemType?: TierSystemType;
}

export function TierInfoCard({ 
  points, 
  thresholds,
  tierNames,
  tierSystemType = 'LOYALTY'
}: TierInfoCardProps) {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;
  const names = tierNames || TIER_PRESETS[tierSystemType];

  const tiers: { level: TierLevel; name: string; threshold: string; active: boolean }[] = [
    { 
      level: "TIER_1",
      name: names.tier1Name, 
      threshold: tierBronzeMax ? `0 - ${tierBronzeMax.toLocaleString()}` : "Entry",
      active: tierBronzeMax === null || points <= tierBronzeMax
    },
    { 
      level: "TIER_2",
      name: names.tier2Name, 
      threshold: tierBronzeMax && tierSilverMax ? `${(tierBronzeMax + 1).toLocaleString()} - ${tierSilverMax.toLocaleString()}` : "—",
      active: tierBronzeMax !== null && tierSilverMax !== null && points > tierBronzeMax && points <= tierSilverMax
    },
    { 
      level: "TIER_3",
      name: names.tier3Name, 
      threshold: tierSilverMax && tierGoldMax ? `${(tierSilverMax + 1).toLocaleString()} - ${tierGoldMax.toLocaleString()}` : "—",
      active: tierSilverMax !== null && tierGoldMax !== null && points > tierSilverMax && points <= tierGoldMax
    },
    { 
      level: "TIER_4",
      name: names.tier4Name, 
      threshold: tierGoldMax ? `${(tierGoldMax + 1).toLocaleString()}+` : "—",
      active: tierGoldMax !== null && points > tierGoldMax
    },
  ];

  if (tierSystemType === 'NONE') {
    return (
      <div className="text-center p-4 rounded-md border border-muted bg-muted/20" data-testid="tier-info-card">
        <TierBadge level="TIER_1" tierNames={tierNames} tierSystemType={tierSystemType} size="md" />
        <div className="text-sm text-muted-foreground mt-2">No tier progression</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-2" data-testid="tier-info-card">
      {tiers.map(({ level, name, threshold, active }) => (
        <div
          key={level}
          className={`text-center p-2 rounded-md border transition-all ${
            active 
              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
              : "border-muted bg-muted/20 opacity-60"
          }`}
        >
          <TierBadge level={level} tierNames={tierNames} tierSystemType={tierSystemType} size="sm" showIcon={false} />
          <div className="text-xs text-muted-foreground mt-1">{threshold}</div>
        </div>
      ))}
    </div>
  );
}
