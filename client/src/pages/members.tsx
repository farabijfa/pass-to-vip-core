import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { memberApi, type Member } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TierBadge } from "@/components/tier-badge";
import { fromLegacyTierLevel, type TierLevel } from "@/lib/tier-calculator";
import { QrCode, Mail, Users } from "lucide-react";

type EnrollmentSource = "ALL" | "SMARTPASS" | "CLAIM_CODE";

const sourceLabels: Record<EnrollmentSource, string> = {
  ALL: "All Sources",
  SMARTPASS: "In-Store QR",
  CLAIM_CODE: "Mailed Campaign",
};

const sourceDescriptions: Record<EnrollmentSource, string> = {
  ALL: "All enrollment channels",
  SMARTPASS: "Scanned your in-store QR code",
  CLAIM_CODE: "Received & scanned a mailed postcard",
};

const sourceIcons: Record<Exclude<EnrollmentSource, "ALL">, typeof QrCode> = {
  SMARTPASS: QrCode,
  CLAIM_CODE: Mail,
};

export default function MembersPage() {
  const { mockMode } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<EnrollmentSource>("ALL");

  const { data: membersResult, isLoading, refetch } = useQuery({
    queryKey: ["members", activeSearch],
    queryFn: () => activeSearch ? memberApi.search(activeSearch) : memberApi.getAll(),
  });

  const allMembers = membersResult?.data?.members || [];
  
  const members = sourceFilter === "ALL" 
    ? allMembers 
    : allMembers.filter(m => m.enrollment_source === sourceFilter);

  const sourceCounts = {
    ALL: allMembers.length,
    SMARTPASS: allMembers.filter(m => m.enrollment_source === "SMARTPASS").length,
    CLAIM_CODE: allMembers.filter(m => m.enrollment_source === "CLAIM_CODE").length,
  };

  const handleSearch = () => {
    setActiveSearch(searchQuery);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setActiveSearch("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight" data-testid="text-members-title">
            Member Lookup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Search and manage your loyalty program members
          </p>
        </div>
        {mockMode && (
          <Badge variant="outline" data-testid="badge-mock-mode">Test Mode</Badge>
        )}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground text-lg">Search Members</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Search by name, email, or external ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-search"
              />
            </div>
            <Button onClick={handleSearch} data-testid="button-search">
              Search
            </Button>
            {activeSearch && (
              <Button variant="outline" onClick={clearSearch} data-testid="button-clear">
                Clear
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              data-testid="button-refresh"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        {(["ALL", "SMARTPASS", "CLAIM_CODE"] as EnrollmentSource[]).map((source) => {
          const isSelected = sourceFilter === source;
          const Icon = source === "ALL" ? Users : sourceIcons[source];
          return (
            <Card
              key={source}
              className={`cursor-pointer transition-all ${
                isSelected 
                  ? "border-primary ring-2 ring-primary/20" 
                  : "hover-elevate"
              }`}
              onClick={() => setSourceFilter(source)}
              data-testid={`button-filter-source-${source.toLowerCase()}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {sourceLabels[source]}
                  </span>
                </div>
                <p className="text-2xl font-semibold text-foreground" data-testid={`text-count-${source.toLowerCase()}`}>
                  {sourceCounts[source]}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {sourceDescriptions[source]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-foreground text-lg">
              {activeSearch ? "Search Results" : sourceFilter === "ALL" ? "All Members" : `${sourceLabels[sourceFilter]} Members`}
            </CardTitle>
            <span className="text-sm text-muted-foreground" data-testid="badge-member-count">
              {members.length} members
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 bg-muted" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-sm">
                {activeSearch ? "No members found matching your search" : 
                 sourceFilter !== "ALL" ? `No members enrolled via ${sourceLabels[sourceFilter]}` :
                 "No members in this program yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Member</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">External ID</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Contact</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Points</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Tier</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-xs text-muted-foreground uppercase tracking-wider">Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeLegacyTierName(tierName: string): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' {
  const normalizedName = tierName?.toUpperCase() || 'BRONZE';
  if (normalizedName.includes('PLATINUM') || normalizedName.includes('TIER_4')) return 'PLATINUM';
  if (normalizedName.includes('GOLD') || normalizedName.includes('TIER_3')) return 'GOLD';
  if (normalizedName.includes('SILVER') || normalizedName.includes('TIER_2')) return 'SILVER';
  return 'BRONZE';
}

function MemberRow({ member }: { member: Member }) {
  const tierLevel = fromLegacyTierLevel(normalizeLegacyTierName(member.tier_name));
  
  return (
    <TableRow 
      className="border-border/50"
      data-testid={`row-member-${member.id}`}
    >
      <TableCell>
        <div>
          <p className="font-medium text-foreground text-sm">
            {member.first_name} {member.last_name}
          </p>
          <p className="text-xs text-muted-foreground">
            Joined {new Date(member.created_at).toLocaleDateString()}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-xs text-foreground bg-muted/50 px-2 py-1 rounded">
          {member.external_id}
        </code>
      </TableCell>
      <TableCell>
        <div className="space-y-0.5">
          <p className="text-sm text-foreground">{member.email}</p>
          {member.phone && (
            <p className="text-xs text-muted-foreground">{member.phone}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="font-medium text-foreground">{member.points_balance.toLocaleString()}</span>
      </TableCell>
      <TableCell>
        <TierBadge level={tierLevel} size="sm" />
      </TableCell>
      <TableCell>
        <span className={`text-xs ${member.status === 'INSTALLED' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {member.status}
        </span>
      </TableCell>
      <TableCell>
        <SourceBadge source={member.enrollment_source} />
      </TableCell>
    </TableRow>
  );
}

function SourceBadge({ source }: { source: string }) {
  const getSourceDisplay = () => {
    switch (source) {
      case "SMARTPASS":
        return { label: "In-Store QR", icon: QrCode, color: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-800" };
      case "CLAIM_CODE":
        return { label: "Mailed", icon: Mail, color: "bg-green-500/10 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-800" };
      default:
        return { label: source || "Unknown", icon: Users, color: "bg-gray-500/10 text-gray-700 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-800" };
    }
  };

  const { label, icon: Icon, color } = getSourceDisplay();

  return (
    <Badge variant="outline" className={`text-xs ${color}`}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  );
}
