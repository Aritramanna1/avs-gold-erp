import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Sparkles,
  Sliders,
  Settings,
  Tag,
  Receipt,
  CheckCircle2,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
  Search,
  Save,
  Scale,
  TrendingUp,
  Landmark,
  FileOutput,
  Users,
  Briefcase,
  Gem,
  Factory,
  Globe,
  Lock,
  Printer,
  MoreHorizontal,
  Monitor,
} from "lucide-react";
import { useCustomizationHubPreferences } from "@/lib/customization-hub-preferences-store";
import type {
  LegacyFeaturesConfig,
  LegacyGeneralConfig,
  LegacyMasterConfig,
  LegacyTaggingConfig,
  LegacyVoucherConfig,
  LegacyValuation1Config,
  LegacyValuation2Config,
  LegacyDefaultValueConfig,
  LegacyExportConfig,
  LegacyMembersConfig,
  LegacySalaryConfig,
  LegacyBullionConfig,
  LegacyManufacturingConfig,
  LegacyWebUploadConfig,
  LegacyGirviConfig,
  LegacyPrintSetupConfig,
  LegacyOtherSetupsConfig,
  LegacyJewelDeskConfig,
} from "@/lib/types/legacy-config-types";

export function LegacyParityConfigurationPanel() {
  // ── Original 5 sections ──
  const features = useCustomizationHubPreferences((s) => s.features);
  const general = useCustomizationHubPreferences((s) => s.general);
  const master = useCustomizationHubPreferences((s) => s.master);
  const tagging = useCustomizationHubPreferences((s) => s.tagging);
  const vouchers = useCustomizationHubPreferences((s) => s.vouchers);
  // ── 13 additional sections ──
  const valuation1 = useCustomizationHubPreferences((s) => s.valuation1);
  const valuation2 = useCustomizationHubPreferences((s) => s.valuation2);
  const defaultValues = useCustomizationHubPreferences((s) => s.defaultValues);
  const exportConfig = useCustomizationHubPreferences((s) => s.exportConfig);
  const members = useCustomizationHubPreferences((s) => s.members);
  const salary = useCustomizationHubPreferences((s) => s.salary);
  const bullion = useCustomizationHubPreferences((s) => s.bullion);
  const manufacturing = useCustomizationHubPreferences((s) => s.manufacturing);
  const webUpload = useCustomizationHubPreferences((s) => s.webUpload);
  const girvi = useCustomizationHubPreferences((s) => s.girvi);
  const printSetup = useCustomizationHubPreferences((s) => s.printSetup);
  const otherSetups = useCustomizationHubPreferences((s) => s.otherSetups);
  const jewelDesk = useCustomizationHubPreferences((s) => s.jewelDesk);

  const saveFeatures = useCustomizationHubPreferences((s) => s.saveFeatures);
  const saveGeneral = useCustomizationHubPreferences((s) => s.saveGeneral);
  const saveMaster = useCustomizationHubPreferences((s) => s.saveMaster);
  const saveTagging = useCustomizationHubPreferences((s) => s.saveTagging);
  const saveVouchers = useCustomizationHubPreferences((s) => s.saveVouchers);
  const saveValuation1 = useCustomizationHubPreferences((s) => s.saveValuation1);
  const saveValuation2 = useCustomizationHubPreferences((s) => s.saveValuation2);
  const saveDefaultValues = useCustomizationHubPreferences((s) => s.saveDefaultValues);
  const saveExportConfig = useCustomizationHubPreferences((s) => s.saveExportConfig);
  const saveMembers = useCustomizationHubPreferences((s) => s.saveMembers);
  const saveSalary = useCustomizationHubPreferences((s) => s.saveSalary);
  const saveBullion = useCustomizationHubPreferences((s) => s.saveBullion);
  const saveManufacturing = useCustomizationHubPreferences((s) => s.saveManufacturing);
  const saveWebUpload = useCustomizationHubPreferences((s) => s.saveWebUpload);
  const saveGirvi = useCustomizationHubPreferences((s) => s.saveGirvi);
  const savePrintSetup = useCustomizationHubPreferences((s) => s.savePrintSetup);
  const saveOtherSetups = useCustomizationHubPreferences((s) => s.saveOtherSetups);
  const saveJewelDesk = useCustomizationHubPreferences((s) => s.saveJewelDesk);
  const saving = useCustomizationHubPreferences((s) => s.saving);

  const [activeSubTab, setActiveSubTab] = useState<string>("features");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Draft state — original 5
  const [featDraft, setFeatDraft] = useState<LegacyFeaturesConfig>(features);
  const [genDraft, setGenDraft] = useState<LegacyGeneralConfig>(general);
  const [mastDraft, setMastDraft] = useState<LegacyMasterConfig>(master);
  const [tagDraft, setTagDraft] = useState<LegacyTaggingConfig>(tagging);
  const [vouchDraft, setVouchDraft] = useState<LegacyVoucherConfig>(vouchers);
  // Draft state — 13 additional sections
  const [val1Draft, setVal1Draft] = useState<LegacyValuation1Config>(valuation1);
  const [val2Draft, setVal2Draft] = useState<LegacyValuation2Config>(valuation2);
  const [defValDraft, setDefValDraft] = useState<LegacyDefaultValueConfig>(defaultValues);
  const [expDraft, setExpDraft] = useState<LegacyExportConfig>(exportConfig);
  const [membDraft, setMembDraft] = useState<LegacyMembersConfig>(members);
  const [salDraft, setSalDraft] = useState<LegacySalaryConfig>(salary);
  const [bullDraft, setBullDraft] = useState<LegacyBullionConfig>(bullion);
  const [mfgDraft, setMfgDraft] = useState<LegacyManufacturingConfig>(manufacturing);
  const [webDraft, setWebDraft] = useState<LegacyWebUploadConfig>(webUpload);
  const [girviDraft, setGirviDraft] = useState<LegacyGirviConfig>(girvi);
  const [printDraft, setPrintDraft] = useState<LegacyPrintSetupConfig>(printSetup);
  const [otherDraft, setOtherDraft] = useState<LegacyOtherSetupsConfig>(otherSetups);
  const [jdDraft, setJdDraft] = useState<LegacyJewelDeskConfig>(jewelDesk);

  const handleSaveFeatures = async () => {
    await saveFeatures(featDraft);
    toast.success("Feature configuration saved successfully.");
  };

  const handleSaveGeneral = async () => {
    await saveGeneral(genDraft);
    toast.success("General system configuration saved successfully.");
  };

  const handleSaveMaster = async () => {
    await saveMaster(mastDraft);
    toast.success("Master conventions & naming rules saved successfully.");
  };

  const handleSaveTagging = async () => {
    await saveTagging(tagDraft);
    toast.success("Tagging & barcode rules saved successfully.");
  };

  const handleSaveVouchers = async () => {
    await saveVouchers(vouchDraft);
    toast.success("Voucher & POS rules saved successfully.");
  };

  const handleSaveValuation1 = async () => { await saveValuation1(val1Draft); toast.success("Stock valuation (Part 1) saved."); };
  const handleSaveValuation2 = async () => { await saveValuation2(val2Draft); toast.success("Stock valuation (Part 2) saved."); };
  const handleSaveDefaultValues = async () => { await saveDefaultValues(defValDraft); toast.success("Default account values saved."); };
  const handleSaveExportConfig = async () => { await saveExportConfig(expDraft); toast.success("Export / Tally settings saved."); };
  const handleSaveMembers = async () => { await saveMembers(membDraft); toast.success("Kitty / Members scheme saved."); };
  const handleSaveSalary = async () => { await saveSalary(salDraft); toast.success("Salary & payroll rules saved."); };
  const handleSaveBullion = async () => { await saveBullion(bullDraft); toast.success("Bullion account settings saved."); };
  const handleSaveManufacturing = async () => { await saveManufacturing(mfgDraft); toast.success("Manufacturing / job work rules saved."); };
  const handleSaveWebUpload = async () => { await saveWebUpload(webDraft); toast.success("Web upload / sync settings saved."); };
  const handleSaveGirvi = async () => { await saveGirvi(girviDraft); toast.success("Girvi (gold loan) settings saved."); };
  const handleSavePrintSetup = async () => { await savePrintSetup(printDraft); toast.success("Print setup saved."); };
  const handleSaveOtherSetups = async () => { await saveOtherSetups(otherDraft); toast.success("Other system setups saved."); };
  const handleSaveJewelDesk = async () => { await saveJewelDesk(jdDraft); toast.success("Jewel Desk POS settings saved."); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20 border border-border p-4 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Sliders className="h-5 w-5 text-gold" />
            Trade &amp; System Configuration Master
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Full parameter parity with production jewellery ERP — 18 configuration sections across Features, General, Master, Tagging, Vouchers, Valuation, Export, Payroll, Bullion, Manufacturing, Girvi, Print &amp; More.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs bg-gold/10 text-gold border-gold/30">
            Authoritative Settings Store
          </Badge>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto p-1 gap-1 bg-muted/40">
          <TabsTrigger value="features" className="py-1.5 text-xs flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Features
          </TabsTrigger>
          <TabsTrigger value="general" className="py-1.5 text-xs flex items-center gap-1">
            <Settings className="h-3 w-3" /> General
          </TabsTrigger>
          <TabsTrigger value="master" className="py-1.5 text-xs flex items-center gap-1">
            <Sliders className="h-3 w-3" /> Master Rules
          </TabsTrigger>
          <TabsTrigger value="tagging" className="py-1.5 text-xs flex items-center gap-1">
            <Tag className="h-3 w-3" /> Tagging
          </TabsTrigger>
          <TabsTrigger value="vouchers" className="py-1.5 text-xs flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Vouchers
          </TabsTrigger>
          <TabsTrigger value="valuation1" className="py-1.5 text-xs flex items-center gap-1">
            <Scale className="h-3 w-3" /> Valuation 1
          </TabsTrigger>
          <TabsTrigger value="valuation2" className="py-1.5 text-xs flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Valuation 2
          </TabsTrigger>
          <TabsTrigger value="defaultValues" className="py-1.5 text-xs flex items-center gap-1">
            <Landmark className="h-3 w-3" /> Defaults
          </TabsTrigger>
          <TabsTrigger value="exportConfig" className="py-1.5 text-xs flex items-center gap-1">
            <FileOutput className="h-3 w-3" /> Export
          </TabsTrigger>
          <TabsTrigger value="members" className="py-1.5 text-xs flex items-center gap-1">
            <Users className="h-3 w-3" /> Members
          </TabsTrigger>
          <TabsTrigger value="salary" className="py-1.5 text-xs flex items-center gap-1">
            <Briefcase className="h-3 w-3" /> Salary
          </TabsTrigger>
          <TabsTrigger value="bullion" className="py-1.5 text-xs flex items-center gap-1">
            <Gem className="h-3 w-3" /> Bullion
          </TabsTrigger>
          <TabsTrigger value="manufacturing" className="py-1.5 text-xs flex items-center gap-1">
            <Factory className="h-3 w-3" /> Mfg / Jobs
          </TabsTrigger>
          <TabsTrigger value="webUpload" className="py-1.5 text-xs flex items-center gap-1">
            <Globe className="h-3 w-3" /> Web Upload
          </TabsTrigger>
          <TabsTrigger value="girvi" className="py-1.5 text-xs flex items-center gap-1">
            <Lock className="h-3 w-3" /> Girvi
          </TabsTrigger>
          <TabsTrigger value="printSetup" className="py-1.5 text-xs flex items-center gap-1">
            <Printer className="h-3 w-3" /> Print Setup
          </TabsTrigger>
          <TabsTrigger value="otherSetups" className="py-1.5 text-xs flex items-center gap-1">
            <MoreHorizontal className="h-3 w-3" /> Other
          </TabsTrigger>
          <TabsTrigger value="jewelDesk" className="py-1.5 text-xs flex items-center gap-1">
            <Monitor className="h-3 w-3" /> Jewel Desk
          </TabsTrigger>
        </TabsList>

        {/* 1. FEATURES */}
        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Features &amp; Modules</CardTitle>
                  <CardDescription className="text-xs">
                    Enable or disable trade modules, sales agents, sub-accounts, and insurance rules.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveFeatures} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Features
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Disable Diamond / Stone Feature</Label>
                    <p className="text-xs text-muted-foreground">Hide studded diamond and gem calculation tabs ERP-wide.</p>
                  </div>
                  <Switch
                    checked={featDraft.disableDiamondStoneFeature}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, disableDiamondStoneFeature: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Use Commission Agent</Label>
                    <p className="text-xs text-muted-foreground">Track external brokers and agent commissions on wholesale.</p>
                  </div>
                  <Switch
                    checked={featDraft.useAgent}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, useAgent: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Use Salesman / Counter Staff</Label>
                    <p className="text-xs text-muted-foreground">Mandate counter salesperson selection on retail sales invoices.</p>
                  </div>
                  <Switch
                    checked={featDraft.useSalesman}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, useSalesman: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Use Sub-Accounts</Label>
                    <p className="text-xs text-muted-foreground">Enable child ledger accounts under primary wholesale parties.</p>
                  </div>
                  <Switch
                    checked={featDraft.useSubAccounts}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, useSubAccounts: c })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Enable Mobile App Sale &amp; Approval</Label>
                    <p className="text-xs text-muted-foreground">Allow sales staff to generate draft estimate bills on mobile app.</p>
                  </div>
                  <Switch
                    checked={featDraft.enableAppSale}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, enableAppSale: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Enable Purchase Orders (PO)</Label>
                    <p className="text-xs text-muted-foreground">Require purchase approval cycle before bullion/stock receipts.</p>
                  </div>
                  <Switch
                    checked={featDraft.enablePurchaseOrder}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, enablePurchaseOrder: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Enable Hindi / Vernacular Dates</Label>
                    <p className="text-xs text-muted-foreground">Display Vikram Samvat and Hindi date formats on statements.</p>
                  </div>
                  <Switch
                    checked={featDraft.enableHindiDate}
                    onCheckedChange={(c) => setFeatDraft({ ...featDraft, enableHindiDate: c })}
                  />
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Default Operational Currency</Label>
                  <Select
                    value={featDraft.defaultCurrency}
                    onValueChange={(v) => setFeatDraft({ ...featDraft, defaultCurrency: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RS.">Indian Rupee (₹ RS.)</SelectItem>
                      <SelectItem value="AED">UAE Dirham (AED)</SelectItem>
                      <SelectItem value="USD">US Dollar ($ USD)</SelectItem>
                      <SelectItem value="EUR">Euro (€ EUR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. GENERAL */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">General System &amp; Security Controls</CardTitle>
                  <CardDescription className="text-xs">
                    Rates feeding, accounting period boundaries, session auto-logout, and duplicate login rules.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveGeneral} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save General
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Daily Gold &amp; Silver Rates at App Start</Label>
                  <Select
                    value={genDraft.dailyRatesAtStart}
                    onValueChange={(v: any) => setGenDraft({ ...genDraft, dailyRatesAtStart: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Prompt Daily Rates on First Login</SelectItem>
                      <SelectItem value="no">Do Not Prompt (Use Existing)</SelectItem>
                      <SelectItem value="restrict_feeding">Restrict Transactions until Rates Fed</SelectItem>
                      <SelectItem value="last_rate">Automatically Carry Forward Last Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Accounting Start Date</Label>
                  <Input
                    value={genDraft.acStartDate}
                    onChange={(e) => setGenDraft({ ...genDraft, acStartDate: e.target.value })}
                    placeholder="DD/MM/YYYY"
                    className="h-9 font-mono"
                  />
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Auto Logout Inactivity Time (Minutes)</Label>
                  <Input
                    type="number"
                    value={genDraft.sessionLogoutMinutes}
                    onChange={(e) => setGenDraft({ ...genDraft, sessionLogoutMinutes: Number(e.target.value) || 0 })}
                    placeholder="0 = Disabled"
                    className="h-9 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">0 disables automatic inactivity timeout.</p>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Duplicate Concurrent Login Policy</Label>
                  <Select
                    value={genDraft.duplicateLoginPolicy}
                    onValueChange={(v: any) => setGenDraft({ ...genDraft, duplicateLoginPolicy: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="allow">Allow Concurrent Logins</SelectItem>
                      <SelectItem value="warn">Warn &amp; Log Session</SelectItem>
                      <SelectItem value="block">Block Duplicate Logins (Single Device)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Data Double Check on Voucher Save</Label>
                    <p className="text-xs text-muted-foreground">Show detailed confirmation summary before posting to ledger.</p>
                  </div>
                  <Switch
                    checked={genDraft.dataDoubleCheckOnSave}
                    onCheckedChange={(c) => setGenDraft({ ...genDraft, dataDoubleCheckOnSave: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Restrict Feeding in Future Dates</Label>
                    <p className="text-xs text-muted-foreground">Prevent backdating or future-dating beyond current business day.</p>
                  </div>
                  <Switch
                    checked={genDraft.restrictFeedingInFutureDate}
                    onCheckedChange={(c) => setGenDraft({ ...genDraft, restrictFeedingInFutureDate: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Stamp-Wise Accounting Separation</Label>
                    <p className="text-xs text-muted-foreground">Maintain discrete ledger accounts for 916, 750, and 999 gold.</p>
                  </div>
                  <Switch
                    checked={genDraft.stampWiseAccounting}
                    onCheckedChange={(c) => setGenDraft({ ...genDraft, stampWiseAccounting: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Tally Integration &amp; XML Export</Label>
                    <p className="text-xs text-muted-foreground">Generate automated Tally Prime XML vouchers on daily close.</p>
                  </div>
                  <Switch
                    checked={genDraft.tallyDataTransfer}
                    onCheckedChange={(c) => setGenDraft({ ...genDraft, tallyDataTransfer: c })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. MASTER */}
        <TabsContent value="master" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Master Records &amp; Field Conventions</CardTitle>
                  <CardDescription className="text-xs">
                    Item naming conventions, design prefixes, stock valuation, tax ID captions, and duplicate mobile validation.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveMaster} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Master Rules
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Item Short Naming Rule</Label>
                  <Select
                    value={mastDraft.shortNameInItems}
                    onValueChange={(v: any) => setMastDraft({ ...mastDraft, shortNameInItems: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Standard Full Item Name</SelectItem>
                      <SelectItem value="same_prefix">Same Tag Prefix</SelectItem>
                      <SelectItem value="diff_prefix">Different Tag Prefix</SelectItem>
                      <SelectItem value="serial_no">Serial Number Prefix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Labour Type in Item Master</Label>
                    <p className="text-xs text-muted-foreground">Specify Per Gram / Per Piece / Percentage labour in item creation.</p>
                  </div>
                  <Switch
                    checked={mastDraft.labourTypeInItem}
                    onCheckedChange={(c) => setMastDraft({ ...mastDraft, labourTypeInItem: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Issue / Receive by Gross Weight</Label>
                    <p className="text-xs text-muted-foreground">Default Karigar issue calculations to gross weight basis.</p>
                  </div>
                  <Switch
                    checked={mastDraft.issueReceiveByGrossWeight}
                    onCheckedChange={(c) => setMastDraft({ ...mastDraft, issueReceiveByGrossWeight: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Display Account Balance in Pickers</Label>
                    <p className="text-xs text-muted-foreground">Show live gold/cash balance when selecting parties in dropdowns.</p>
                  </div>
                  <Switch
                    checked={mastDraft.displayAccountBalanceInList}
                    onCheckedChange={(c) => setMastDraft({ ...mastDraft, displayAccountBalanceInList: c })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Tax ID / Statutory Captions</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="PAN Caption"
                      value={mastDraft.panNoCaption}
                      onChange={(e) => setMastDraft({ ...mastDraft, panNoCaption: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                    <Input
                      placeholder="UID Caption"
                      value={mastDraft.uidnoCaption}
                      onChange={(e) => setMastDraft({ ...mastDraft, uidnoCaption: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                    <Input
                      placeholder="TAN/GSTIN"
                      value={mastDraft.tanNoCaption}
                      onChange={(e) => setMastDraft({ ...mastDraft, tanNoCaption: e.target.value })}
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">OTP Verification on Account Creation</Label>
                    <p className="text-xs text-muted-foreground">Verify customer mobile numbers via SMS OTP during master onboarding.</p>
                  </div>
                  <Switch
                    checked={mastDraft.otpVerificationInAccountCreation}
                    onCheckedChange={(c) => setMastDraft({ ...mastDraft, otpVerificationInAccountCreation: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Restrict Duplicate Mobile in Accounts</Label>
                    <p className="text-xs text-muted-foreground">Enforce unique mobile number per customer/party profile.</p>
                  </div>
                  <Switch
                    checked={mastDraft.restrictDuplicateMobileInAccounts}
                    onCheckedChange={(c) => setMastDraft({ ...mastDraft, restrictDuplicateMobileInAccounts: c })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 4. TAGGING */}
        <TabsContent value="tagging" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Tagging, Barcodes &amp; RFID Desk</CardTitle>
                  <CardDescription className="text-xs">
                    Tag generation modes, HUID validation, auto-print triggers, and repeat tagging attributes.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveTagging} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Tagging Rules
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Tag Numbering Sequence</Label>
                  <Select
                    value={tagDraft.tagNumberingMode}
                    onValueChange={(v: any) => setTagDraft({ ...tagDraft, tagNumberingMode: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_serial">Auto Global Serial (e.g. TG001042)</SelectItem>
                      <SelectItem value="lot_wise">Lot-wise Prefix (e.g. LOT-26-001)</SelectItem>
                      <SelectItem value="job_card_no">Generate as Job Card Number</SelectItem>
                      <SelectItem value="manual">Manual Input by Operator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">General Tag Prefix</Label>
                  <Input
                    value={tagDraft.generalTagPrefix}
                    onChange={(e) => setTagDraft({ ...tagDraft, generalTagPrefix: e.target.value })}
                    className="h-9 font-mono"
                    placeholder="TG"
                  />
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Branch Tag Prefix</Label>
                  <Input
                    value={tagDraft.branchTagPrefix}
                    onChange={(e) => setTagDraft({ ...tagDraft, branchTagPrefix: e.target.value })}
                    className="h-9 font-mono"
                    placeholder="BR1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Restrict Duplicate HUIDs</Label>
                    <p className="text-xs text-muted-foreground">Block duplicate 6-digit alphanumeric BIS Hallmark UIDs.</p>
                  </div>
                  <Switch
                    checked={tagDraft.restrictDuplicateHuid}
                    onCheckedChange={(c) => setTagDraft({ ...tagDraft, restrictDuplicateHuid: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Tag Print with Generation</Label>
                    <p className="text-xs text-muted-foreground">Auto-dispatch print command to thermal label printer on save.</p>
                  </div>
                  <Switch
                    checked={tagDraft.tagPrintWithGeneration}
                    onCheckedChange={(c) => setTagDraft({ ...tagDraft, tagPrintWithGeneration: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Check Tag Net Weight on Save</Label>
                    <p className="text-xs text-muted-foreground">Ensure gross weight minus less weight equals exact net weight.</p>
                  </div>
                  <Switch
                    checked={tagDraft.checkTagNetWeightOnSave}
                    onCheckedChange={(c) => setTagDraft({ ...tagDraft, checkTagNetWeightOnSave: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Update MRP by Daily Gold Rates</Label>
                    <p className="text-xs text-muted-foreground">Recalculate dynamic retail display pricing based on daily bhav.</p>
                  </div>
                  <Switch
                    checked={tagDraft.updateMrpByDailyRates}
                    onCheckedChange={(c) => setTagDraft({ ...tagDraft, updateMrpByDailyRates: c })}
                  />
                </div>
              </div>

              {/* Repeat in Tagging Checkbox Matrix */}
              <div className="p-4 border rounded-lg bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-foreground">
                    Repeat in Continuous Tagging (Retain values for next item)
                  </Label>
                  <span className="text-xs text-muted-foreground">Saves operator time during bulk tagging</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                  {Object.entries(tagDraft.repeatInTagging).map(([key, val]) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={val}
                        onChange={(e) =>
                          setTagDraft({
                            ...tagDraft,
                            repeatInTagging: {
                              ...tagDraft.repeatInTagging,
                              [key]: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-border text-gold focus:ring-gold"
                      />
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    </label>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 5. VOUCHERS */}
        <TabsContent value="vouchers" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Voucher &amp; Point of Sale (POS) Policies</CardTitle>
                  <CardDescription className="text-xs">
                    Cursor focus rules, daily bhav source, cash customer accounting, Badla / Bhav cut mechanics, and Kachchi balancing.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveVouchers} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Voucher Rules
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Default Cursor in Sale</Label>
                  <Select
                    value={vouchDraft.defaultCursorInSale}
                    onValueChange={(v: any) => setVouchDraft({ ...vouchDraft, defaultCursorInSale: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="party_name">Party Name (Blank)</SelectItem>
                      <SelectItem value="grid">Item Scanning Grid</SelectItem>
                      <SelectItem value="cash_party">Default Cash Party</SelectItem>
                      <SelectItem value="narration">Narration / Notes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Pick Daily Bhav By</Label>
                  <Select
                    value={vouchDraft.pickDailyBhavBy}
                    onValueChange={(v: any) => setVouchDraft({ ...vouchDraft, pickDailyBhavBy: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stamp_purity">Stamp / Purity (e.g. 22K/18K)</SelectItem>
                      <SelectItem value="item_group">Item Group Default</SelectItem>
                      <SelectItem value="none">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 border rounded-lg bg-card space-y-2">
                  <Label className="text-sm font-semibold">Cash Party Balance Policy</Label>
                  <Select
                    value={vouchDraft.cashPartyBalancePolicy}
                    onValueChange={(v: any) => setVouchDraft({ ...vouchDraft, cashPartyBalancePolicy: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dont_save">Direct Cash Settlement (No Ledger)</SelectItem>
                      <SelectItem value="save_as_cash_customer">Save into Cash Customer Account</SelectItem>
                      <SelectItem value="require_ledger_account">Mandate Ledger Account Creation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Receive Fine in Cash Book</Label>
                    <p className="text-xs text-muted-foreground">Allow pure fine gold postings directly in cash book register.</p>
                  </div>
                  <Switch
                    checked={vouchDraft.receiveFineInCashBook}
                    onCheckedChange={(c) => setVouchDraft({ ...vouchDraft, receiveFineInCashBook: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Show Rupees in Words on Vouchers</Label>
                    <p className="text-xs text-muted-foreground">Print full verbal Indian English rupee amount on receipt slips.</p>
                  </div>
                  <Switch
                    checked={vouchDraft.showRsInWordsInVoucher}
                    onCheckedChange={(c) => setVouchDraft({ ...vouchDraft, showRsInWordsInVoucher: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Badla with Bhav Cut Mechanics</Label>
                    <p className="text-xs text-muted-foreground">Apply interest badla rates automatically on deferred settlement bhav cuts.</p>
                  </div>
                  <Switch
                    checked={vouchDraft.badlaWithBhavCut}
                    onCheckedChange={(c) => setVouchDraft({ ...vouchDraft, badlaWithBhavCut: c })}
                  />
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div>
                    <Label className="text-sm font-semibold">Maintain Separate Kachchi Balance</Label>
                    <p className="text-xs text-muted-foreground">Track estimate/kachchi running metal positions separately from pakka GST ledger.</p>
                  </div>
                  <Switch
                    checked={vouchDraft.maintainSeparateKachiBalance}
                    onCheckedChange={(c) => setVouchDraft({ ...vouchDraft, maintainSeparateKachiBalance: c })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 6. VALUATION 1 */}
        <TabsContent value="valuation1" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Stock Valuation — Part 1</CardTitle>
                  <CardDescription className="text-xs">Costing methods, issue/receive basis, and weight basis for inventory valuation.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveValuation1} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Loose Stock Valuation Method</Label>
                  <Select value={val1Draft.looseStockMethod} onValueChange={(v) => setVal1Draft({ ...val1Draft, looseStockMethod: v as typeof val1Draft.looseStockMethod })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fifo">FIFO</SelectItem>
                      <SelectItem value="avg_cost">Average Cost</SelectItem>
                      <SelectItem value="group_rate">Group Rate</SelectItem>
                      <SelectItem value="last_rate">Last Rate</SelectItem>
                      <SelectItem value="fixed_rate">Fixed Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Issue / Receive Basis</Label>
                  <Select value={val1Draft.issueReceiveBasis} onValueChange={(v) => setVal1Draft({ ...val1Draft, issueReceiveBasis: v as typeof val1Draft.issueReceiveBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todays_rate">Today's Rate</SelectItem>
                      <SelectItem value="purchase_cost">Purchase Cost</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Closing Stock Basis</Label>
                  <Select value={val1Draft.closingStockAtCostOrMarket} onValueChange={(v) => setVal1Draft({ ...val1Draft, closingStockAtCostOrMarket: v as typeof val1Draft.closingStockAtCostOrMarket })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">At Cost</SelectItem>
                      <SelectItem value="market">At Market</SelectItem>
                      <SelectItem value="lower_of_cost_or_market">Lower of Cost or Market</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Valuation Weight Basis</Label>
                  <Select value={val1Draft.valuationWeightBasis} onValueChange={(v) => setVal1Draft({ ...val1Draft, valuationWeightBasis: v as typeof val1Draft.valuationWeightBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gross">Gross Weight</SelectItem>
                      <SelectItem value="net">Net Weight</SelectItem>
                      <SelectItem value="fine">Fine Weight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {([
                ["consolidateBranchesForValuation", "Consolidate branches for valuation", "Pool stock across all branches when computing closing values."],
                ["showUnrealisedProfitLoss", "Show unrealised P&L in balance sheet", "Surface mark-to-market gain/loss in the balance sheet."],
                ["includeWastageInCost", "Include wastage in cost of production", "Add metal wastage to manufacturing cost."],
                ["includeHallmarkInValuation", "Include hallmarking charges in valuation", "Add BIS hallmarking cost to stock value."],
                ["perUnitValuation", "Per-unit valuation (multi-piece items)", "Value each piece independently in multi-qty lines."],
              ] as [keyof LegacyValuation1Config, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!val1Draft[key]} onCheckedChange={(c) => setVal1Draft({ ...val1Draft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 7. VALUATION 2 */}
        <TabsContent value="valuation2" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Stock Valuation — Part 2</CardTitle>
                  <CardDescription className="text-xs">Tagged stock basis, customer balance basis, interest on outstanding, and TDS settings.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveValuation2} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tagged Stock Valuation Basis</Label>
                  <Select value={val2Draft.taggedStockValuationBasis} onValueChange={(v) => setVal2Draft({ ...val2Draft, taggedStockValuationBasis: v as typeof val2Draft.taggedStockValuationBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">At Cost</SelectItem>
                      <SelectItem value="todays_rate">Today's Rate</SelectItem>
                      <SelectItem value="mrp">MRP</SelectItem>
                      <SelectItem value="retail">Retail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Customer Balance Basis</Label>
                  <Select value={val2Draft.customerBalanceBasis} onValueChange={(v) => setVal2Draft({ ...val2Draft, customerBalanceBasis: v as typeof val2Draft.customerBalanceBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash Only</SelectItem>
                      <SelectItem value="fine">Fine Gold Only</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Interest on Outstanding Rate (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={val2Draft.interestOnOutstandingRatePct} onChange={(e) => setVal2Draft({ ...val2Draft, interestOnOutstandingRatePct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Interest Grace Days</Label>
                  <Input type="number" className="h-8 text-xs" value={val2Draft.interestGraceDays} onChange={(e) => setVal2Draft({ ...val2Draft, interestGraceDays: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">TDS Account Name</Label>
                  <Input className="h-8 text-xs" value={val2Draft.tdsAccountName} onChange={(e) => setVal2Draft({ ...val2Draft, tdsAccountName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Commission Basis</Label>
                  <Select value={val2Draft.commissionBasis} onValueChange={(v) => setVal2Draft({ ...val2Draft, commissionBasis: v as typeof val2Draft.commissionBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="amount">Amount</SelectItem>
                      <SelectItem value="fine">Fine Gold</SelectItem>
                      <SelectItem value="net_weight">Net Weight</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {([
                ["gstRcmOnOldGoldPurchase", "GST / RCM on old gold purchase", "Apply reverse charge on unregistered old gold purchases."],
                ["tdsOnGoldPurchaseEnabled", "TDS on gold purchase", "Deduct TDS on gold purchases above threshold."],
                ["interestOnOutstandingEnabled", "Interest on outstanding balances", "Compute interest on overdue party balances."],
                ["splitFineAndMakingInValuation", "Split fine and making in valuation", "Report fine and making component separately in stock value."],
                ["deductKacchiFromClosingBalance", "Deduct kacchi from closing balance", "Remove kachchi/estimate positions from the net closing stock."],
              ] as [keyof LegacyValuation2Config, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!val2Draft[key]} onCheckedChange={(c) => setVal2Draft({ ...val2Draft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 8. DEFAULT VALUES */}
        <TabsContent value="defaultValues" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Default Account Values</CardTitle>
                  <CardDescription className="text-xs">Default ledger accounts, group names, purity defaults, and opening balance types.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveDefaultValues} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["defaultCashCustomerGroup", "Default Cash Customer Group"],
                  ["defaultCreditCustomerGroup", "Default Credit Customer Group"],
                  ["defaultBullionPurchaseAccount", "Bullion Purchase Account"],
                  ["defaultBullionSaleAccount", "Bullion Sale Account"],
                  ["defaultInterestIncomeAccount", "Interest Income Account"],
                  ["defaultDiscountAllowedAccount", "Discount Allowed Account"],
                  ["defaultDiscountReceivedAccount", "Discount Received Account"],
                  ["defaultCommissionAccount", "Commission Account"],
                  ["defaultBankChargesAccount", "Bank Charges Account"],
                  ["defaultFreightAccount", "Freight Account"],
                  ["defaultLabourIncomeAccount", "Labour Income Account"],
                  ["defaultStoneDiamondAccount", "Stone / Diamond Account"],
                  ["defaultWastageAccount", "Wastage Account"],
                ] as [keyof LegacyDefaultValueConfig, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{label}</Label>
                    <Input className="h-8 text-xs" value={String(defValDraft[key] ?? "")} onChange={(e) => setDefValDraft({ ...defValDraft, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Gold Purity (permille)</Label>
                  <Input type="number" className="h-8 text-xs" value={defValDraft.defaultGoldPurityPermille} onChange={(e) => setDefValDraft({ ...defValDraft, defaultGoldPurityPermille: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Silver Purity (permille)</Label>
                  <Input type="number" className="h-8 text-xs" value={defValDraft.defaultSilverPurityPermille} onChange={(e) => setDefValDraft({ ...defValDraft, defaultSilverPurityPermille: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Opening Balance Type for New Parties</Label>
                  <Select value={defValDraft.defaultOpeningBalanceType} onValueChange={(v) => setDefValDraft({ ...defValDraft, defaultOpeningBalanceType: v as "debit" | "credit" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit (Dr)</SelectItem>
                      <SelectItem value="credit">Credit (Cr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 9. EXPORT */}
        <TabsContent value="exportConfig" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Export &amp; Tally Settings</CardTitle>
                  <CardDescription className="text-xs">Tally XML, Excel column order, auto-export schedule, and date format.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveExportConfig} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Tally Company Name</Label>
                  <Input className="h-8 text-xs" value={expDraft.tallyCompanyName} onChange={(e) => setExpDraft({ ...expDraft, tallyCompanyName: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Auto-Export Schedule</Label>
                  <Select value={expDraft.autoExportSchedule} onValueChange={(v) => setExpDraft({ ...expDraft, autoExportSchedule: v as typeof expDraft.autoExportSchedule })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Manual)</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Export Date Format</Label>
                  <Select value={expDraft.exportDateFormat} onValueChange={(v) => setExpDraft({ ...expDraft, exportDateFormat: v as typeof expDraft.exportDateFormat })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                      <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                      <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {([
                ["tallyXmlExportEnabled", "Tally XML Export", "Enable exporting vouchers to Tally XML format."],
                ["exportStockToTally", "Export Stock to Tally", "Include stock transactions in Tally XML export."],
                ["exportOpeningBalancesToTally", "Export Opening Balances to Tally", "Include opening balances in the Tally export."],
                ["includeCancelledVouchersInExport", "Include Cancelled Vouchers", "Include void/cancelled vouchers in data exports."],
              ] as [keyof LegacyExportConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!expDraft[key]} onCheckedChange={(c) => setExpDraft({ ...expDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 10. MEMBERS / KITTY */}
        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Members / Gold Kitty Scheme</CardTitle>
                  <CardDescription className="text-xs">Gold savings scheme duration, bonus, early withdrawal, and notification rules.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveMembers} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div><Label className="text-sm font-semibold">Gold Savings Scheme</Label><p className="text-xs text-muted-foreground">Enable the gold kitty / savings scheme module.</p></div>
                <Switch checked={membDraft.goldSavingsSchemeEnabled} onCheckedChange={(c) => setMembDraft({ ...membDraft, goldSavingsSchemeEnabled: c })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Duration (months)</Label>
                  <Input type="number" className="h-8 text-xs" value={membDraft.defaultSchemeDurationMonths} onChange={(e) => setMembDraft({ ...membDraft, defaultSchemeDurationMonths: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bonus Instalment Count</Label>
                  <Input type="number" className="h-8 text-xs" value={membDraft.bonusInstalmentCount} onChange={(e) => setMembDraft({ ...membDraft, bonusInstalmentCount: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bonus Type</Label>
                  <Select value={membDraft.bonusType} onValueChange={(v) => setMembDraft({ ...membDraft, bonusType: v as typeof membDraft.bonusType })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_instalment">Free Instalment</SelectItem>
                      <SelectItem value="discount_on_purchase">Discount on Purchase</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Scheme Name Prefix</Label>
                  <Input className="h-8 text-xs" value={membDraft.schemePrefixName} onChange={(e) => setMembDraft({ ...membDraft, schemePrefixName: e.target.value })} />
                </div>
              </div>
              {([
                ["allowEarlyWithdrawal", "Allow Early Withdrawal", "Permit members to redeem before scheme completion."],
                ["notifyOnInstalmentDue", "Notify on Instalment Due", "Send reminder notifications on due dates."],
                ["separateLedgerGroupForSchemes", "Separate Ledger Group for Schemes", "Track scheme instalments in a dedicated ledger group."],
              ] as [keyof LegacyMembersConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!membDraft[key]} onCheckedChange={(c) => setMembDraft({ ...membDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 11. SALARY */}
        <TabsContent value="salary" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Salary &amp; Payroll</CardTitle>
                  <CardDescription className="text-xs">
                    Salary calculation method, piece-rate wages, PF/ESI rates, TDS on salary, and payment accounts.
                  </CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveSalary} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Salary / Wage Calculation Mode</Label>
                  <Select
                    value={(salDraft as any).salaryCalculationMode || "monthly"}
                    onValueChange={(v) => setSalDraft({ ...salDraft, salarySlipCycle: v === "daily" ? "fortnightly" : "monthly" })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Fixed Monthly Salary (Staff)</SelectItem>
                      <SelectItem value="daily">Daily Wages / Attendance Rate</SelectItem>
                      <SelectItem value="piece_rate">Piece-rate / Karigar Job Labour</SelectItem>
                      <SelectItem value="wastage_labour">Wastage &amp; Labour Combined</SelectItem>
                      <SelectItem value="commission">Sales Commission &amp; Incentive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Attendance Method</Label>
                  <Select value={salDraft.attendanceMethod} onValueChange={(v) => setSalDraft({ ...salDraft, attendanceMethod: v as typeof salDraft.attendanceMethod })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="biometric">Biometric</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="app_checkin">App Check-In</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Salary Slip Cycle</Label>
                  <Select value={salDraft.salarySlipCycle} onValueChange={(v) => setSalDraft({ ...salDraft, salarySlipCycle: v as "monthly" | "fortnightly" })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">TDS on Salary Rate (%)</Label>
                  <Input type="number" step="0.1" className="h-8 text-xs" value={(salDraft as any).tdsRatePct || 10} onChange={(e) => setSalDraft({ ...salDraft, tdsSalaryEnabled: true })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Employee PF Rate (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={salDraft.pfEmployeeRatePct} onChange={(e) => setSalDraft({ ...salDraft, pfEmployeeRatePct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Employer PF Rate (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={salDraft.pfEmployerRatePct} onChange={(e) => setSalDraft({ ...salDraft, pfEmployerRatePct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">ESI Rate (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={salDraft.esiRatePct} onChange={(e) => setSalDraft({ ...salDraft, esiRatePct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Salary Payment Account</Label>
                  <Input className="h-8 text-xs" value={salDraft.salaryPaymentAccount} onChange={(e) => setSalDraft({ ...salDraft, salaryPaymentAccount: e.target.value })} />
                </div>
              </div>
              {([
                ["pfEnabled", "Provident Fund (PF)", "Enable PF deduction and contribution tracking."],
                ["esiEnabled", "Employee State Insurance (ESI)", "Enable ESI contribution tracking."],
                ["tdsSalaryEnabled", "TDS on Salary", "Deduct TDS from employee and worker salary disbursements."],
                ["allowAdvanceSalaryDeduction", "Allow Advance Salary Deduction", "Permit advance salary amounts to be deducted from payroll."],
              ] as [keyof LegacySalaryConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!salDraft[key]} onCheckedChange={(c) => setSalDraft({ ...salDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 12. BULLION */}
        <TabsContent value="bullion" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Bullion Accounts &amp; Settings</CardTitle>
                  <CardDescription className="text-xs">Gold/silver ledger accounts, import duty, sauda, badla, and kacchi gold.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveBullion} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["goldPurchaseAccount", "Gold Purchase Account"],
                  ["goldSalesAccount", "Gold Sales Account"],
                  ["silverPurchaseAccount", "Silver Purchase Account"],
                  ["silverSalesAccount", "Silver Sales Account"],
                  ["goldVaultAccount", "Gold Vault / Custody Account"],
                  ["kacchiGoldAccount", "Kacchi (Impure) Gold Account"],
                  ["refiningChargesAccount", "Refining Charges Account"],
                ] as [keyof LegacyBullionConfig, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{label}</Label>
                    <Input className="h-8 text-xs" value={String(bullDraft[key] ?? "")} onChange={(e) => setBullDraft({ ...bullDraft, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Badla Mode</Label>
                  <Select value={bullDraft.badlaMode} onValueChange={(v) => setBullDraft({ ...bullDraft, badlaMode: v as typeof bullDraft.badlaMode })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nil">Nil</SelectItem>
                      <SelectItem value="auto">Auto</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">GST on Bullion (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={bullDraft.gstOnBullionPct} onChange={(e) => setBullDraft({ ...bullDraft, gstOnBullionPct: +e.target.value })} />
                </div>
              </div>
              {([
                ["separateSilverLedger", "Separate Silver Ledger", "Track silver in a dedicated ledger separate from gold."],
                ["saudaEnabled", "Sauda (Forward Contract)", "Enable forward contract sauda entry."],
                ["requireHallmarkPurityInPurchase", "Require Hallmark Purity", "Mandate certified hallmark purity in bullion purchase."],
                ["lockBullionPurityToCertifiedValues", "Lock Purity to Certified Values", "Restrict purity entry to BIS-certified values only."],
              ] as [keyof LegacyBullionConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!bullDraft[key]} onCheckedChange={(c) => setBullDraft({ ...bullDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 13. MANUFACTURING */}
        <TabsContent value="manufacturing" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Manufacturing &amp; Job Work</CardTitle>
                  <CardDescription className="text-xs">Job card mode, gold issue basis, karigar wage rules, and loss accounting.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveManufacturing} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Manufacturing Mode</Label>
                  <Select value={mfgDraft.manufacturingMode} onValueChange={(v) => setMfgDraft({ ...mfgDraft, manufacturingMode: v as typeof mfgDraft.manufacturingMode })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_based">Order Based</SelectItem>
                      <SelectItem value="direct_issue">Direct Issue</SelectItem>
                      <SelectItem value="job_work">Job Work</SelectItem>
                      <SelectItem value="subcontract">Subcontract</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gold Issue Basis</Label>
                  <Select value={mfgDraft.goldIssueBasis} onValueChange={(v) => setMfgDraft({ ...mfgDraft, goldIssueBasis: v as typeof mfgDraft.goldIssueBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_quantity">Order Quantity</SelectItem>
                      <SelectItem value="gross_weight">Gross Weight</SelectItem>
                      <SelectItem value="fine_weight">Fine Weight</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Karigar Wage Basis</Label>
                  <Select value={mfgDraft.karigarWageBasis} onValueChange={(v) => setMfgDraft({ ...mfgDraft, karigarWageBasis: v as typeof mfgDraft.karigarWageBasis })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece_rate">Piece Rate</SelectItem>
                      <SelectItem value="weight_rate">Weight Rate</SelectItem>
                      <SelectItem value="daily_rate">Daily Rate</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Loss (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={mfgDraft.defaultLossPct} onChange={(e) => setMfgDraft({ ...mfgDraft, defaultLossPct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Max Karigar Gold Holding (days)</Label>
                  <Input type="number" className="h-8 text-xs" value={mfgDraft.maxKarigarGoldHoldingDays} onChange={(e) => setMfgDraft({ ...mfgDraft, maxKarigarGoldHoldingDays: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Making Charges Account</Label>
                  <Input className="h-8 text-xs" value={mfgDraft.makingChargesAccount} onChange={(e) => setMfgDraft({ ...mfgDraft, makingChargesAccount: e.target.value })} />
                </div>
              </div>
              {([
                ["requireApprovalBeforeGoldIssue", "Require Approval Before Gold Issue", "Mandate supervisor approval before issuing gold to karigar."],
                ["enforceReceiptSlipOnReturn", "Enforce Receipt Slip on Return", "Require receipt slip before accepting gold return."],
                ["allowPartialGoldReturn", "Allow Partial Gold Return", "Permit partial returns against an active order."],
                ["autoGenerateJobCardFromOrder", "Auto-generate Job Card from Order", "Automatically create job cards when orders are confirmed."],
              ] as [keyof LegacyManufacturingConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!mfgDraft[key]} onCheckedChange={(c) => setMfgDraft({ ...mfgDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 14. WEB UPLOAD */}
        <TabsContent value="webUpload" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Web Upload &amp; Cloud Sync</CardTitle>
                  <CardDescription className="text-xs">Sync endpoint, API key, batch size, and data categories to sync.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveWebUpload} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div><Label className="text-sm font-semibold">Web Sync Enabled</Label><p className="text-xs text-muted-foreground">Enable cloud/web data synchronisation.</p></div>
                <Switch checked={webDraft.webSyncEnabled} onCheckedChange={(c) => setWebDraft({ ...webDraft, webSyncEnabled: c })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sync Endpoint URL</Label>
                  <Input className="h-8 text-xs" value={webDraft.syncEndpointUrl} onChange={(e) => setWebDraft({ ...webDraft, syncEndpointUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">API Key</Label>
                  <Input className="h-8 text-xs" type="password" value={webDraft.syncApiKey} onChange={(e) => setWebDraft({ ...webDraft, syncApiKey: e.target.value })} placeholder="sk-..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Auto-Sync Interval (minutes, 0=manual)</Label>
                  <Input type="number" className="h-8 text-xs" value={webDraft.autoSyncIntervalMinutes} onChange={(e) => setWebDraft({ ...webDraft, autoSyncIntervalMinutes: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Sync Batch Size</Label>
                  <Input type="number" className="h-8 text-xs" value={webDraft.syncBatchSize} onChange={(e) => setWebDraft({ ...webDraft, syncBatchSize: +e.target.value })} />
                </div>
              </div>
              {([
                ["syncStock", "Sync Stock / Inventory", "Include inventory data in sync."],
                ["syncCustomers", "Sync Customer Accounts", "Include customer ledger accounts in sync."],
                ["syncDailyRates", "Sync Daily Gold Rates", "Push/pull daily gold rates to/from cloud."],
                ["syncInvoices", "Sync Invoices / Sales", "Include billing transactions in sync."],
                ["syncKarigarBook", "Sync Karigar Book", "Include karigar metal entries in sync."],
                ["offlineQueueEnabled", "Offline Queue", "Queue unsynced changes when offline and replay on reconnect."],
                ["customerMobileLedgerEnabled", "Customer Mobile Ledger", "Allow customers to view their ledger via the mobile app."],
              ] as [keyof LegacyWebUploadConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!webDraft[key]} onCheckedChange={(c) => setWebDraft({ ...webDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 15. GIRVI */}
        <TabsContent value="girvi" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Girvi — Gold Loan &amp; Pledge</CardTitle>
                  <CardDescription className="text-xs">Loan account, interest method, LTV, penalty, and auction trigger settings.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveGirvi} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div><Label className="text-sm font-semibold">Girvi Module Enabled</Label><p className="text-xs text-muted-foreground">Enable the gold loan / pledge (Girvi) module.</p></div>
                <Switch checked={girviDraft.girviEnabled} onCheckedChange={(c) => setGirviDraft({ ...girviDraft, girviEnabled: c })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Girvi Loan Account</Label>
                  <Input className="h-8 text-xs" value={girviDraft.girviLoanAccount} onChange={(e) => setGirviDraft({ ...girviDraft, girviLoanAccount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Interest Income Account</Label>
                  <Input className="h-8 text-xs" value={girviDraft.girviInterestAccount} onChange={(e) => setGirviDraft({ ...girviDraft, girviInterestAccount: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Interest Rate (% per month)</Label>
                  <Input type="number" className="h-8 text-xs" value={girviDraft.defaultInterestRatePerMonth} onChange={(e) => setGirviDraft({ ...girviDraft, defaultInterestRatePerMonth: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Interest Calculation Method</Label>
                  <Select value={girviDraft.interestCalculationMethod} onValueChange={(v) => setGirviDraft({ ...girviDraft, interestCalculationMethod: v as typeof girviDraft.interestCalculationMethod })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="reducing_balance">Reducing Balance</SelectItem>
                      <SelectItem value="simple_per_day">Simple Per Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Max LTV (%)</Label>
                  <Input type="number" className="h-8 text-xs" value={girviDraft.maxLtvPct} onChange={(e) => setGirviDraft({ ...girviDraft, maxLtvPct: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Auction Trigger Days</Label>
                  <Input type="number" className="h-8 text-xs" value={girviDraft.auctionTriggerDays} onChange={(e) => setGirviDraft({ ...girviDraft, auctionTriggerDays: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Girvi Receipt Prefix</Label>
                  <Input className="h-8 text-xs" value={girviDraft.girviReceiptPrefix} onChange={(e) => setGirviDraft({ ...girviDraft, girviReceiptPrefix: e.target.value })} />
                </div>
              </div>
              {([
                ["allowPartialRedemption", "Allow Partial Redemption", "Permit partial loan repayment and partial pledge release."],
                ["autoTransferToAuction", "Auto-transfer to Auction", "Automatically move overdue pledges to auction account."],
              ] as [keyof LegacyGirviConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!girviDraft[key]} onCheckedChange={(c) => setGirviDraft({ ...girviDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 16. PRINT SETUP */}
        <TabsContent value="printSetup" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Print Setup</CardTitle>
                  <CardDescription className="text-xs">Company name, address, GSTIN, bank details, signatory, T&amp;C, and paper size on printed documents.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSavePrintSetup} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  ["printCompanyName", "Company Name"],
                  ["printAddressLine1", "Address Line 1"],
                  ["printAddressLine2", "Address Line 2"],
                  ["printCityStatePIN", "City, State, PIN"],
                  ["printGstin", "GSTIN"],
                  ["printPan", "PAN"],
                  ["printPhone", "Phone"],
                  ["printEmail", "Email"],
                  ["printWebsite", "Website"],
                  ["printBankName", "Bank Name"],
                  ["printBankAccountNo", "Bank Account No."],
                  ["printIfscCode", "IFSC Code"],
                  ["printSignatoryName", "Signatory Name"],
                  ["printSignatoryDesignation", "Signatory Designation"],
                ] as [keyof LegacyPrintSetupConfig, string][]).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{label}</Label>
                    <Input className="h-8 text-xs" value={String(printDraft[key] ?? "")} onChange={(e) => setPrintDraft({ ...printDraft, [key]: e.target.value })} />
                  </div>
                ))}
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-semibold">Terms &amp; Conditions</Label>
                  <Input className="h-8 text-xs" value={printDraft.printTermsAndConditions} onChange={(e) => setPrintDraft({ ...printDraft, printTermsAndConditions: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Default Paper Size</Label>
                  <Select value={printDraft.defaultPaperSize} onValueChange={(v) => setPrintDraft({ ...printDraft, defaultPaperSize: v as typeof printDraft.defaultPaperSize })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="A5">A5</SelectItem>
                      <SelectItem value="thermal_3inch">Thermal 3"</SelectItem>
                      <SelectItem value="thermal_4inch">Thermal 4"</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Header Colour (hex)</Label>
                  <Input className="h-8 text-xs" type="color" value={printDraft.printHeaderColor} onChange={(e) => setPrintDraft({ ...printDraft, printHeaderColor: e.target.value })} />
                </div>
              </div>
              {([
                ["printLogo", "Print Company Logo", "Include the firm logo on all printed documents."],
                ["printHallmarkDetails", "Print BIS / Hallmark Details", "Show hallmark certification on print."],
                ["printWatermarkOnDraft", "Print Watermark on Draft / Cancelled", "Show DRAFT or CANCELLED watermark on non-final documents."],
              ] as [keyof LegacyPrintSetupConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!printDraft[key]} onCheckedChange={(c) => setPrintDraft({ ...printDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 17. OTHER SETUPS */}
        <TabsContent value="otherSetups" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Other System Setups</CardTitle>
                  <CardDescription className="text-xs">Day-end lock, user activity log, 2FA, gold rate ticker, and alert settings.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveOtherSetups} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Auto Day-End Lock Time</Label>
                  <Input className="h-8 text-xs" type="time" value={otherDraft.autoDayEndLockTime} onChange={(e) => setOtherDraft({ ...otherDraft, autoDayEndLockTime: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Session Idle Timeout (minutes)</Label>
                  <Input type="number" className="h-8 text-xs" value={otherDraft.sessionIdleTimeoutMinutes} onChange={(e) => setOtherDraft({ ...otherDraft, sessionIdleTimeoutMinutes: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Max Failed Login Attempts</Label>
                  <Input type="number" className="h-8 text-xs" value={otherDraft.maxFailedLoginAttempts} onChange={(e) => setOtherDraft({ ...otherDraft, maxFailedLoginAttempts: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Audit Log Retention (days)</Label>
                  <Input type="number" className="h-8 text-xs" value={otherDraft.auditRetentionDays} onChange={(e) => setOtherDraft({ ...otherDraft, auditRetentionDays: +e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Gold Rate Ticker URL</Label>
                  <Input className="h-8 text-xs" value={otherDraft.goldRateTickerUrl} onChange={(e) => setOtherDraft({ ...otherDraft, goldRateTickerUrl: e.target.value })} placeholder="https://..." />
                </div>
              </div>
              {([
                ["requireDailyRateEntry", "Require Daily Rate Entry", "Block voucher entry until today's gold rate is fed."],
                ["allowVoucherWithoutRate", "Allow Vouchers Without Rate", "Permit voucher creation even when gold rate is absent."],
                ["autoDayEndLock", "Auto Day-End Lock", "Lock books automatically at the configured lock time."],
                ["enableUserActivityLog", "User Activity Log", "Record all user actions in the audit trail."],
                ["showGoldRateTicker", "Show Gold Rate Ticker", "Display live gold rate ticker in the UI header."],
                ["twoFactorForCriticalActions", "2FA for Critical Actions", "Require two-factor authentication for delete/reverse actions."],
                ["dailySummaryEmailEnabled", "Daily Summary Email", "Send a daily business summary to designated email recipients."],
                ["whatsappAlertsEnabled", "WhatsApp Alerts", "Send critical event alerts via WhatsApp."],
              ] as [keyof LegacyOtherSetupsConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!otherDraft[key]} onCheckedChange={(c) => setOtherDraft({ ...otherDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 18. JEWEL DESK */}
        <TabsContent value="jewelDesk" className="space-y-4">
          <Card>
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Jewel Desk — POS</CardTitle>
                  <CardDescription className="text-xs">POS quick-sale mode, receipt printer, barcode scanner, and customer display settings.</CardDescription>
                </div>
                <Button size="sm" onClick={handleSaveJewelDesk} disabled={saving} className="bg-gold hover:bg-gold/90 text-white gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
                <div><Label className="text-sm font-semibold">Jewel Desk POS Enabled</Label><p className="text-xs text-muted-foreground">Enable the Jewel Desk point-of-sale module.</p></div>
                <Switch checked={jdDraft.jewelDeskEnabled} onCheckedChange={(c) => setJdDraft({ ...jdDraft, jewelDeskEnabled: c })} />
              </div>
              {([
                ["quickSaleModeEnabled", "Quick-Sale Mode", "Bypass full order workflow for ready-stock cash sales."],
                ["showStockImagesOnPos", "Show Stock Images", "Display product photos on the POS grid."],
                ["touchOptimisedMode", "Touch-Optimised Mode", "Enlarge touch targets for touch-screen POS terminals."],
                ["showCustomerBalanceOnPos", "Show Customer Balance", "Display outstanding gold and cash balance on POS."],
                ["showGoldRateOnPos", "Show Gold Rate", "Display live board gold rate on POS screen."],
                ["allowDiscountOnQuickSale", "Allow Quick-Sale Discount", "Allow operators to apply discounts during checkout."],
                ["autoPrintReceiptAfterSale", "Auto-Print Receipt", "Auto-print a receipt after every POS transaction."],
                ["requireManagerPinForDiscount", "Require PIN for Discount", "Require manager PIN override for discounts."],
              ] as [keyof LegacyJewelDeskConfig, string, string][]).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                  <div><Label className="text-sm font-semibold">{label}</Label><p className="text-xs text-muted-foreground">{desc}</p></div>
                  <Switch checked={!!jdDraft[key]} onCheckedChange={(c) => setJdDraft({ ...jdDraft, [key]: c })} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
