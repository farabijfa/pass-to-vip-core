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
import { Search, Users, RefreshCw, User, Mail, Phone, Coins } from "lucide-react";

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
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-members-title">Member Lookup</h1>
          <p className="text-muted-foreground">Search and manage your loyalty program members</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Data</Badge>
        )}
      </div>

      <Card className="border-border bg-card/80">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Members
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Search by name, email, or external ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                data-testid="input-search"
              />
            </div>
            <Button onClick={handleSearch} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
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
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/80">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-foreground flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {activeSearch ? "Search Results" : "All Members"}
            </CardTitle>
            <Badge variant="outline" className="text-foreground" data-testid="badge-member-count">
              {membersResult?.data?.count || 0} members
            </Badge>
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
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {activeSearch ? "No members found matching your search" : "No members in this program yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Member</TableHead>
                    <TableHead className="text-muted-foreground">External ID</TableHead>
                    <TableHead className="text-muted-foreground">Contact</TableHead>
                    <TableHead className="text-muted-foreground">Points</TableHead>
                    <TableHead className="text-muted-foreground">Tier</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
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
  const statusColors: Record<string, string> = {
    INSTALLED: "bg-primary/20 text-primary",
    UNINSTALLED: "bg-secondary/20 text-secondary",
    PENDING: "bg-muted/50 text-muted-foreground",
  };

  const sourceColors: Record<string, string> = {
    SMARTPASS: "bg-primary/20 text-primary",
    CSV: "bg-secondary/20 text-secondary",
    CLAIM_CODE: "bg-muted/30 text-foreground",
  };

  return (
    <TableRow 
      className="border-border/50 hover:bg-muted/30"
      data-testid={`row-member-${member.id}`}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {member.first_name} {member.last_name}
            </p>
            <p className="text-sm text-muted-foreground">
              Joined {new Date(member.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm text-foreground bg-muted/50 px-2 py-1 rounded">
          {member.external_id}
        </code>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-foreground">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {member.email}
          </div>
          {member.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3 w-3" />
              {member.phone}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-secondary" />
          <span className="font-medium text-foreground">{member.points_balance.toLocaleString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-foreground">
          {member.tier_name}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={statusColors[member.status] || "bg-muted/50 text-muted-foreground"}>
          {member.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={sourceColors[member.enrollment_source] || "bg-muted/50 text-muted-foreground"}>
          {member.enrollment_source}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
