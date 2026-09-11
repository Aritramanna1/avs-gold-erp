import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
  Search,
  Sparkles,
  Layers,
  FileCode,
  ShieldCheck,
  Building2,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
} from "lucide-react";

export const Route = createFileRoute("/ui/catalog" as any)({
  head: () => ({ meta: [{ title: "UI Design System Catalog · AVS ERP" }] }),
  component: UICatalogPage,
});

export function UICatalogPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-gold">
                AVS ERP Design System & Component Catalog
              </h1>
              <Badge variant="outline" className="border-gold/40 text-gold font-mono text-[10px]">
                ONE AVS ERP · CANONICAL
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Authoritative UI rulebook reference, design tokens, and canonical primitives as defined in docs/UI-DESIGN-SYSTEM.md.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 800);
              }}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground font-medium gap-1.5"
              onClick={() => window.open("/docs/UI-DESIGN-SYSTEM.md", "_blank")}
            >
              <FileCode className="h-3.5 w-3.5" /> View Rulebook MD
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
          <TabsList className="bg-muted p-1 border border-border rounded-lg flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-card">
              Overview & Tokens
            </TabsTrigger>
            <TabsTrigger value="buttons" className="text-xs data-[state=active]:bg-card">
              Buttons & Actions
            </TabsTrigger>
            <TabsTrigger value="forms" className="text-xs data-[state=active]:bg-card">
              Forms & Inputs
            </TabsTrigger>
            <TabsTrigger value="cards" className="text-xs data-[state=active]:bg-card">
              Cards & Surfaces
            </TabsTrigger>
            <TabsTrigger value="tables" className="text-xs data-[state=active]:bg-card">
              Tables & Lists
            </TabsTrigger>
            <TabsTrigger value="badges" className="text-xs data-[state=active]:bg-card">
              Badges & Status
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs data-[state=active]:bg-card">
              Alerts & Feedback
            </TabsTrigger>
          </TabsList>

          {/* OVERVIEW & TOKENS */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-gold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Brand Gold (#a88445)
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Token: text-gold / border-gold / bg-gold
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-12 w-full rounded-md bg-gold flex items-center justify-center text-primary-foreground font-mono text-xs font-bold">
                    AVS Hallmark Gold
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for brand accents, high-level headers, active tabs, and primary luxury callouts.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base text-primary flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> Operational Navy / Primary
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Token: bg-primary / text-primary
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="h-12 w-full rounded-md bg-primary flex items-center justify-center text-primary-foreground font-mono text-xs font-bold">
                    Standard Action Navy
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used for primary form submissions, active state selections, and operational CTAs.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border bg-card shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Typography Stack
                  </CardTitle>
                  <CardDescription className="text-xs font-mono">
                    Serif · Sans · Monospace
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Headers: </span>
                    <span className="font-serif font-bold text-gold">Playfair Display / Serif</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Body/Forms: </span>
                    <span className="font-sans font-normal">Inter / Segoe UI / Sans</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amounts/Rates: </span>
                    <span className="font-mono font-bold text-foreground">JetBrains Mono / Monospace</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="font-serif text-lg text-gold">The 10 Core UI Commandments</CardTitle>
                <CardDescription className="text-xs">
                  Rules that must be adhered to on every feature, modal, and route.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-xs leading-relaxed">
                <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">1. Component Reuse First:</strong> Always check and reuse existing primitives from <code className="bg-muted px-1 rounded font-mono">@/components/ui</code>.
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">2. Unified Page Header:</strong> Every screen starts with a page header featuring a serif title, font-mono metadata subtitle, and right-aligned actions.
                  </div>
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted/40 flex items-start gap-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-foreground">3. No Foreign Color Backdrops:</strong> Never introduce rogue full-screen dark slate (<code className="bg-muted px-1 rounded font-mono">bg-slate-950</code>) or zinc classes. Always use <code className="bg-muted px-1 rounded font-mono">bg-background</code> and <code className="bg-muted px-1 rounded font-mono">bg-card</code>.
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUTTONS */}
          <TabsContent value="buttons" className="space-y-6">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="font-serif text-base text-gold">Button Hierarchy & Variants</CardTitle>
                <CardDescription className="text-xs">
                  Standard button styles used across Owner Console, ERP, Portals, and Auth.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Standard Sizes & Styles</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" className="h-8 text-xs bg-primary text-primary-foreground">
                      Primary Navy
                    </Button>
                    <Button size="sm" className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground">
                      Gold Accent
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs border-border">
                      Secondary Outline
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs">
                      Ghost Action
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 text-xs">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Destructive
                    </Button>
                    <Button size="sm" disabled className="h-8 text-xs">
                      Disabled
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">With Icons & Modifiers</Label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Create New Tenant
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-border">
                      <Lock className="h-3.5 w-3.5" /> Manage Clearance
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FORMS */}
          <TabsContent value="forms" className="space-y-6">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="font-serif text-base text-gold">Form Controls & Layouts</CardTitle>
                <CardDescription className="text-xs">
                  Unified form fields, heights (32px / 36px), borders, and validation states.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Standard Text Input</Label>
                    <Input
                      placeholder="e.g. Arivahly Venture Sphere"
                      value={inputVal}
                      onChange={(e) => setInputVal(e.target.value)}
                      className="h-9 text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground font-mono">Helper note for field input.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center justify-between">
                      <span>Input with Leading Icon</span>
                      <span className="text-gold font-mono text-[10px]">REQUIRED</span>
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search records..." className="h-9 text-xs pl-8" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-red-400">Error State</Label>
                    <Input
                      defaultValue="invalid-email@"
                      className="h-9 text-xs border-red-500/50 bg-red-500/5 focus-visible:ring-red-500"
                    />
                    <p className="text-[11px] text-red-400 font-mono">Please enter a valid email address.</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Disabled Input</Label>
                    <Input disabled value="TENANT_SLUG_LOCKED" className="h-9 text-xs font-mono" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CARDS */}
          <TabsContent value="cards" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-border bg-card shadow-xs">
                <CardHeader>
                  <CardTitle className="font-serif text-base text-gold">Standard Content Card</CardTitle>
                  <CardDescription className="text-xs">
                    Card container with border-border and subtle shadow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground leading-relaxed">
                  Every card encapsulates a cohesive operational unit with consistent padding (<code className="font-mono">p-4</code> or <code className="font-mono">p-6</code>).
                </CardContent>
                <CardFooter className="flex justify-between border-t border-border pt-4">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    Cancel
                  </Button>
                  <Button size="sm" className="h-8 text-xs bg-gold hover:bg-gold/90 text-primary-foreground">
                    Save Changes
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-gold/30 bg-gold/5 shadow-xs">
                <CardHeader>
                  <CardTitle className="font-serif text-base text-gold flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Highlight / Selected Card
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Border-gold with bg-gold/5 background tint for active selections.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-xs leading-relaxed">
                  Used for plan selection tiles, primary metrics, or highlighted tenant environments.
                </CardContent>
                <CardFooter className="flex justify-end border-t border-gold/20 pt-4">
                  <Badge variant="outline" className="border-gold text-gold font-mono text-[10px]">
                    SELECTED ACTIVE
                  </Badge>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* TABLES */}
          <TabsContent value="tables" className="space-y-6">
            <Card className="border-border bg-card shadow-xs overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base text-gold">Standard ERP Table Design</CardTitle>
                <CardDescription className="text-xs">
                  Header rows, font-mono alignment, status badges, and hover states.
                </CardDescription>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground font-mono uppercase text-[10px] border-y border-border">
                    <tr>
                      <th className="px-4 py-2.5">Tenant Firm</th>
                      <th className="px-4 py-2.5">Plan Tier</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">Gold Vault Balance</th>
                      <th className="px-4 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium">Shree Jewellers Pvt Ltd</td>
                      <td className="px-4 py-3 font-mono text-[11px]">Enterprise Cloud</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]">
                          ACTIVE
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gold">
                        1,420.550 g
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Manage
                        </Button>
                      </td>
                    </tr>
                    <tr className="hover:bg-muted/40 transition-colors">
                      <td className="px-4 py-3 font-medium">Mayur Hallmark Works</td>
                      <td className="px-4 py-3 font-mono text-[11px]">Professional</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]">
                          TRIAL (4 DAYS)
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gold">
                        350.200 g
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="h-7 text-xs">
                          Manage
                        </Button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* BADGES */}
          <TabsContent value="badges" className="space-y-6">
            <Card className="border-border bg-card shadow-xs">
              <CardHeader>
                <CardTitle className="font-serif text-base text-gold">Canonical Status Badges</CardTitle>
                <CardDescription className="text-xs">
                  Standard color coding across ERP, Karigar, Workshop, and Platform.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                    ACTIVE
                  </Badge>
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-xs">
                    PENDING / TRIAL
                  </Badge>
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-xs">
                    PROCESSING / DRAFT
                  </Badge>
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                    APPROVED
                  </Badge>
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">
                    SUSPENDED / REJECTED
                  </Badge>
                  <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                    ARCHIVED
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEEDBACK & ALERTS */}
          <TabsContent value="feedback" className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-emerald-300">Success State</div>
                  <div>Tenant environment provisioned and ready for operations.</div>
                </div>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-amber-300">Warning Notification</div>
                  <div>Subscription renewal is due in 3 days. Verify automated payment method.</div>
                </div>
              </div>

              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-start gap-2.5">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-red-300">Error / Policy Alert</div>
                  <div>Failed to synchronize ledger balances. Ensure database connectivity.</div>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground flex items-start gap-2.5">
                <Info className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-gold">Informational Notice</div>
                  <div>All AVS ERP UI adheres to the unified specification in docs/UI-DESIGN-SYSTEM.md.</div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
