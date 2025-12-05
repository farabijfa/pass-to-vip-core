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
import { TierBadge } from "@/components/tier-badge";
import { type TierLevel } from "@/lib/tier-calculator";

export default function MembersPage() {
  const { mockMode } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");

  const { data: membersResult, isLoading, refetch } = useQuery({
    queryKey: ["members", activeSearch],
    queryFn: () => activeSearch ? memberApi.search(activeSearch) : memberApi.getAll(),
  });

  const members = membersResult?.data?.members || [];

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

      <Card className="border-border">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-foreground text-lg">
              {activeSearch ? "Search Results" : "All Members"}
            </CardTitle>
            <span className="text-sm text-muted-foreground" data-testid="badge-member-count">
              {membersResult?.data?.count || 0} members
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
                {activeSearch ? "No members found matching your search" : "No members in this program yet"}
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

function MemberRow({ member }: { member: Member }) {
  const getTierLevel = (tierName: string): TierLevel => {
    const normalizedName = tierName?.toUpperCase() || 'BRONZE';
    if (normalizedName.includes('PLATINUM')) return 'PLATINUM';
    if (normalizedName.includes('GOLD')) return 'GOLD';
    if (normalizedName.includes('SILVER')) return 'SILVER';
    return 'BRONZE';
  };

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
        <TierBadge level={getTierLevel(member.tier_name)} size="sm" />
      </TableCell>
      <TableCell>
        <span className={`text-xs ${member.status === 'INSTALLED' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {member.status}
        </span>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground">{member.enrollment_source}</span>
      </TableCell>
    </TableRow>
  );
}
