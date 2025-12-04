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
          <h1 className="text-2xl font-bold text-white" data-testid="text-members-title">Member Lookup</h1>
          <p className="text-slate-400">Search and manage your loyalty program members</p>
        </div>
        {mockMode && (
          <Badge variant="secondary" data-testid="badge-mock-mode">Mock Data</Badge>
        )}
      </div>

      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Search Members
          </CardTitle>
          <CardDescription className="text-slate-400">
            Search by name, email, or external ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-400"
                data-testid="input-search"
              />
            </div>
            <Button onClick={handleSearch} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            {activeSearch && (
              <Button variant="outline" onClick={clearSearch} className="border-slate-600" data-testid="button-clear">
                Clear
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => refetch()} 
              className="border-slate-600"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-700 bg-slate-800/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {activeSearch ? "Search Results" : "All Members"}
            </CardTitle>
            <Badge variant="outline" className="text-slate-300" data-testid="badge-member-count">
              {membersResult?.data?.count || 0} members
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 bg-slate-700" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">
                {activeSearch ? "No members found matching your search" : "No members in this program yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Member</TableHead>
                    <TableHead className="text-slate-400">External ID</TableHead>
                    <TableHead className="text-slate-400">Contact</TableHead>
                    <TableHead className="text-slate-400">Points</TableHead>
                    <TableHead className="text-slate-400">Tier</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Source</TableHead>
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
    INSTALLED: "bg-green-500/20 text-green-400",
    UNINSTALLED: "bg-red-500/20 text-red-400",
    PENDING: "bg-yellow-500/20 text-yellow-400",
  };

  const sourceColors: Record<string, string> = {
    SMARTPASS: "bg-blue-500/20 text-blue-400",
    CSV: "bg-purple-500/20 text-purple-400",
    CLAIM_CODE: "bg-green-500/20 text-green-400",
  };

  return (
    <TableRow 
      className="border-slate-700/50 hover:bg-slate-700/30"
      data-testid={`row-member-${member.id}`}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-700 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="font-medium text-white">
              {member.first_name} {member.last_name}
            </p>
            <p className="text-sm text-slate-400">
              Joined {new Date(member.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm text-slate-300 bg-slate-700/50 px-2 py-1 rounded">
          {member.external_id}
        </code>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Mail className="h-3 w-3 text-slate-400" />
            {member.email}
          </div>
          {member.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Phone className="h-3 w-3" />
              {member.phone}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-yellow-500" />
          <span className="font-medium text-white">{member.points_balance.toLocaleString()}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-slate-300">
          {member.tier_name}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={statusColors[member.status] || "bg-slate-500/20 text-slate-400"}>
          {member.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge className={sourceColors[member.enrollment_source] || "bg-slate-500/20 text-slate-400"}>
          {member.enrollment_source}
        </Badge>
      </TableCell>
    </TableRow>
  );
}
