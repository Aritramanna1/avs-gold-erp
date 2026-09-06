import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCustomer360Profiles, type Customer360Profile } from "@/lib/crm-360-store";
import { formatCurrencyRupees } from "@/lib/numbers";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  Crown,
  History,
  ShoppingBag,
  Clock,
  Sparkles,
  ShieldCheck,
  Plus,
  MessageSquare,
  FileText,
  CreditCard,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/crm/360/$id")({
  head: () => ({
    meta: [
      { title: "Customer 360 · AVS CRM" },
      { name: "description", content: "Complete 360 customer profile and relationship timeline." },
    ],
  }),
  component: Customer360Page,
});

function Customer360Page() {
  const profiles = getCustomer360Profiles();
  const customer = profiles[0]; // Active sample profile

  const [activeTab, setActiveTab] = useState<'timeline' | 'preferences' | 'family' | 'documents'>('timeline');

  if (!customer) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Customer profile not found.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <PageHeader
        title="Customer 360 Workspace"
        description="Unified relationship timeline, preferences, family ties, and purchase history."
      />

      {/* Customer Header Identity Card */}
      <Card className="p-6 border bg-card/80 backdrop-blur">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-gold/10 text-gold flex items-center justify-center font-bold text-2xl border border-gold/20 shrink-0">
              {customer.fullName.charAt(0)}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-bold tracking-tight text-foreground">{customer.fullName}</h2>
                <Badge className="bg-gold text-black font-semibold flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  {customer.tier} Tier
                </Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  {customer.customerCode}
                </Badge>
              </div>

              <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground pt-1">
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-gold" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-gold" />
                    {customer.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gold" />
                  {customer.city}, {customer.state}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="p-3 rounded-lg border bg-background/50 text-center">
              <span className="text-[11px] text-muted-foreground block">Lifetime Value</span>
              <span className="text-sm font-bold text-emerald-500 font-mono">
                {formatCurrencyRupees(customer.lifetimeValuePaise / 100)}
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-background/50 text-center">
              <span className="text-[11px] text-muted-foreground block">Total Purchases</span>
              <span className="text-sm font-bold text-foreground font-mono">
                {customer.totalPurchasesCount} Invoices
              </span>
            </div>
            <div className="p-3 rounded-lg border bg-background/50 text-center col-span-2 sm:col-span-1">
              <span className="text-[11px] text-muted-foreground block">Relationship Owner</span>
              <span className="text-xs font-semibold text-gold truncate block">
                {customer.relationshipOwner ?? 'Showroom Desk'}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border/60 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'timeline' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <History className="h-4 w-4" />
          Relationship Timeline
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'preferences' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Jewellery Preferences
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'family' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          Family & Occasions
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'documents' ? 'border-gold text-gold' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          Consent & KYC
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'timeline' && (
        <Card className="p-6 border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight">Complete Interaction History</h3>
            <Button size="sm" variant="outline" className="text-xs flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Note / Task
            </Button>
          </div>

          <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-[2px] before:bg-border/60 pl-8">
            {customer.timeline.map((event) => (
              <div key={event.id} className="relative space-y-1">
                <div className="absolute -left-8 top-1 h-3 w-3 rounded-full bg-gold border-2 border-background" />
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-foreground">{event.title}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{event.description}</p>
                {event.amountPaise && (
                  <span className="inline-block text-[11px] font-mono text-emerald-500 font-semibold">
                    Amount: {formatCurrencyRupees(event.amountPaise / 100)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'preferences' && (
        <Card className="p-6 border space-y-4">
          <h3 className="text-sm font-bold tracking-tight">Customer Jewellery Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <span className="font-semibold text-gold block">Purity & Metals</span>
              <div className="flex gap-2">
                {customer.preferences.goldPurity.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <span className="font-semibold text-gold block">Design Style & Aesthetics</span>
              <p className="text-muted-foreground">{customer.preferences.stylePreference} Traditional Crafts</p>
            </div>

            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <span className="font-semibold text-gold block">Favorite Categories</span>
              <div className="flex gap-1.5 flex-wrap">
                {customer.preferences.categories.map((c) => (
                  <Badge key={c} variant="outline">{c}</Badge>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-lg border bg-background/50 space-y-2">
              <span className="font-semibold text-gold block">Standard Sizes</span>
              <p className="text-muted-foreground">Ring Size: {customer.preferences.ringSize ?? 'N/A'} · Bangle Size: {customer.preferences.bangleSize ?? 'N/A'}</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'family' && (
        <Card className="p-6 border space-y-4">
          <h3 className="text-sm font-bold tracking-tight">Family Members & Linked Occasions</h3>
          <div className="space-y-3">
            {customer.familyMembers.map((fam) => (
              <div key={fam.id} className="p-3 border rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold">{fam.name}</span>
                  <span className="text-muted-foreground ml-2 capitalize">({fam.relation})</span>
                </div>
                <div className="text-right text-muted-foreground font-mono text-[11px]">
                  {fam.birthday && <div>Birthday: {fam.birthday}</div>}
                  {fam.anniversary && <div>Anniversary: {fam.anniversary}</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'documents' && (
        <Card className="p-6 border space-y-4">
          <h3 className="text-sm font-bold tracking-tight">Consent & Compliance Settings</h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Transactional WhatsApp Messages</span>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">Opted In</Badge>
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <span>Promotional & Festival Offers</span>
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">Opted In</Badge>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
