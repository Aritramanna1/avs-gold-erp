import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLeadPipeline, type LeadRecord, type LeadStage } from "@/lib/lead-pipeline-store";
import { formatCurrencyRupees } from "@/lib/numbers";
import {
  Users,
  Plus,
  Flame,
  Search,
  Phone,
  Calendar,
  DollarSign,
  UserCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/crm/leads")({
  head: () => ({
    meta: [
      { title: "Leads & Enquiries · AVS CRM" },
      { name: "description", content: "Showroom lead pipeline and enquiry management." },
    ],
  }),
  component: LeadsPage,
});

const PIPELINE_STAGES: LeadStage[] = [
  'New',
  'Contacted',
  'Qualified',
  'Product Discussion',
  'Appointment',
  'Quotation',
  'Negotiation',
  'Won',
  'Lost',
];

function LeadsPage() {
  const [leads, setLeads] = useState<LeadRecord[]>(getLeadPipeline);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeads = leads.filter(
    (l) =>
      l.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.phone.includes(searchQuery) ||
      l.categoryRequested.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Lead Pipeline & Enquiries"
          description="Track customer requirements from initial enquiry through appointment, quotation, and sale."
        />
        <Button className="bg-gold hover:bg-gold/90 text-black font-semibold text-xs flex items-center gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Create New Lead
        </Button>
      </div>

      {/* Search and Summary */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads by customer, phone, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          {filteredLeads.length} Leads in Pipeline
        </Badge>
      </div>

      {/* Leads Table */}
      <Card className="border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 border-b uppercase font-semibold text-[10px] text-muted-foreground">
              <tr>
                <th className="p-3.5">Lead / Customer</th>
                <th className="p-3.5">Category Requested</th>
                <th className="p-3.5">Budget & Value</th>
                <th className="p-3.5">Temp</th>
                <th className="p-3.5">Current Stage</th>
                <th className="p-3.5">Assigned Staff</th>
                <th className="p-3.5">Next Follow-up</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3.5">
                    <div className="font-semibold text-foreground">{lead.customerName}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">{lead.phone}</div>
                  </td>
                  <td className="p-3.5 font-medium">{lead.categoryRequested}</td>
                  <td className="p-3.5 font-mono font-semibold text-emerald-500">
                    {formatCurrencyRupees(lead.budgetPaise / 100)}
                  </td>
                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        lead.temperature === 'HOT'
                          ? 'text-rose-500 border-rose-500/30 bg-rose-500/10'
                          : lead.temperature === 'WARM'
                          ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                          : 'text-sky-500 border-sky-500/30 bg-sky-500/10'
                      }`}
                    >
                      {lead.temperature}
                    </Badge>
                  </td>
                  <td className="p-3.5">
                    <Badge variant="secondary" className="font-semibold">{lead.stage}</Badge>
                  </td>
                  <td className="p-3.5 text-muted-foreground">{lead.assignedStaff}</td>
                  <td className="p-3.5 font-mono text-[11px] text-muted-foreground">
                    {new Date(lead.nextFollowupDate).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-right">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-gold hover:text-gold/80">
                      View Lead
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
