import { Badge } from "@/components/ui/badge";
import { Medal, Award, Trophy, Crown, Star } from "lucide-react";
import { type TierLevel, getTierName, getTierColor } from "@/lib/tier-calculator";

interface TierBadgeProps {
  level: TierLevel;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const tierIcons = {
  BRONZE: Medal,
  SILVER: Award,
  GOLD: Trophy,
  PLATINUM: Crown,
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

export function TierBadge({ level, showIcon = true, size = "md", className = "" }: TierBadgeProps) {
  const { bg, text, border } = getTierColor(level);
  const Icon = tierIcons[level] || Star;
  const name = getTierName(level);

  return (
    <Badge
      data-testid={`badge-tier-${level.toLowerCase()}`}
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
  showDetails?: boolean;
}

export function TierProgress({ points, thresholds, showDetails = true }: TierProgressProps) {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;

  const calculateProgress = (): { level: TierLevel; progress: number; nextThreshold: number | null; pointsNeeded: number | null } => {
    if (!tierBronzeMax && !tierSilverMax && !tierGoldMax) {
      return { level: "BRONZE", progress: 100, nextThreshold: null, pointsNeeded: null };
    }

    if (tierBronzeMax !== null && points <= tierBronzeMax) {
      const progress = (points / tierBronzeMax) * 100;
      return { 
        level: "BRONZE", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierBronzeMax + 1,
        pointsNeeded: tierBronzeMax - points + 1
      };
    }

    if (tierSilverMax !== null && points <= tierSilverMax) {
      const start = tierBronzeMax || 0;
      const range = tierSilverMax - start;
      const progress = ((points - start) / range) * 100;
      return { 
        level: "SILVER", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierSilverMax + 1,
        pointsNeeded: tierSilverMax - points + 1
      };
    }

    if (tierGoldMax !== null && points <= tierGoldMax) {
      const start = tierSilverMax || 0;
      const range = tierGoldMax - start;
      const progress = ((points - start) / range) * 100;
      return { 
        level: "GOLD", 
        progress: Math.min(progress, 100), 
        nextThreshold: tierGoldMax + 1,
        pointsNeeded: tierGoldMax - points + 1
      };
    }

    return { level: "PLATINUM", progress: 100, nextThreshold: null, pointsNeeded: null };
  };

  const { level, progress, pointsNeeded } = calculateProgress();
  const { bg } = getTierColor(level);

  const nextTierName = (): string | null => {
    switch (level) {
      case "BRONZE": return "Silver";
      case "SILVER": return "Gold";
      case "GOLD": return "Platinum";
      default: return null;
    }
  };

  return (
    <div className="space-y-2" data-testid="tier-progress">
      <div className="flex items-center justify-between">
        <TierBadge level={level} size="sm" />
        {showDetails && pointsNeeded !== null && (
          <span className="text-xs text-muted-foreground">
            {pointsNeeded.toLocaleString()} pts to {nextTierName()}
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
}

export function TierInfoCard({ points, thresholds }: TierInfoCardProps) {
  const { tierBronzeMax, tierSilverMax, tierGoldMax } = thresholds;

  const tiers: { level: TierLevel; threshold: string; active: boolean }[] = [
    { 
      level: "BRONZE", 
      threshold: tierBronzeMax ? `0 - ${tierBronzeMax.toLocaleString()}` : "Entry",
      active: tierBronzeMax === null || points <= tierBronzeMax
    },
    { 
      level: "SILVER", 
      threshold: tierBronzeMax && tierSilverMax ? `${(tierBronzeMax + 1).toLocaleString()} - ${tierSilverMax.toLocaleString()}` : "—",
      active: tierBronzeMax !== null && tierSilverMax !== null && points > tierBronzeMax && points <= tierSilverMax
    },
    { 
      level: "GOLD", 
      threshold: tierSilverMax && tierGoldMax ? `${(tierSilverMax + 1).toLocaleString()} - ${tierGoldMax.toLocaleString()}` : "—",
      active: tierSilverMax !== null && tierGoldMax !== null && points > tierSilverMax && points <= tierGoldMax
    },
    { 
      level: "PLATINUM", 
      threshold: tierGoldMax ? `${(tierGoldMax + 1).toLocaleString()}+` : "—",
      active: tierGoldMax !== null && points > tierGoldMax
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2" data-testid="tier-info-card">
      {tiers.map(({ level, threshold, active }) => (
        <div
          key={level}
          className={`text-center p-2 rounded-md border transition-all ${
            active 
              ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
              : "border-muted bg-muted/20 opacity-60"
          }`}
        >
          <TierBadge level={level} size="sm" showIcon={false} />
          <div className="text-xs text-muted-foreground mt-1">{threshold}</div>
        </div>
      ))}
    </div>
  );
}
