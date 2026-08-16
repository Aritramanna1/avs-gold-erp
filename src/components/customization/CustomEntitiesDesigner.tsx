/**
 * Custom Business Entities & Dynamic Record Types Designer
 * Master Reference: docs/MASTER/CUSTOM_FIELDS_AND_FORMS_MASTER.md
 * Master Reference: docs/MASTER/CUSTOMIZATION_MASTER.md
 *
 * "An authorized tenant should be able to create a new business record type where safe.
 * Example: Stone Contractor (Name, Mobile, Stone Type, Rate, Outstanding, Notes).
 * Then that entity can participate in search, custom transactions, reports, and permissions."
 */
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  UserCheck,
  Tag,
  Phone,
  Mail,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  ensureCustomEntitiesLoaded,
  useCustomEntitiesStore,
  type CustomEntityField,
  type CustomEntityDefinition,
} from "@/lib/custom-entities-store";

export type { CustomEntityField, CustomEntityDefinition };

export function CustomEntitiesDesigner() {
  const { entities, records, loading, hydrated, hydrate, addEntity, addRecord } =
    useCustomEntitiesStore();
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [isNewEntityModalOpen, setIsNewEntityModalOpen] = useState(false);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // New Entity Form State
  const [newEntityName, setNewEntityName] = useState("");
  const [newEntityCode, setNewEntityCode] = useState("");
  const [newEntityCategory, setNewEntityCategory] = useState<
    "counterparty" | "inventory" | "workshop" | "custom"
  >("counterparty");
  const [newEntityDesc, setNewEntityDesc] = useState("");
  const [entityFields, setEntityFields] = useState<CustomEntityField[]>([]);

  // Field Form State
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<CustomEntityField["type"]>("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");

  useEffect(() => {
    void ensureCustomEntitiesLoaded();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && entities.length > 0 && !selectedEntityId) {
      setSelectedEntityId(entities[0].id);
    }
  }, [hydrated, entities, selectedEntityId]);

  // Record Form Inputs
  const [recordName, setRecordName] = useState("");
  const [recordPhone, setRecordPhone] = useState("");
  const [recordEmail, setRecordEmail] = useState("");
  const [recordAttributes, setRecordAttributes] = useState<Record<string, any>>({});

  const activeEntity = entities.find((e) => e.id === selectedEntityId) || entities[0];

  const handleAddFieldToDraft = () => {
    if (!fieldLabel.trim()) {
      toast.error("Please enter a field label.");
      return;
    }
    const cleanName = (fieldName.trim() || fieldLabel.trim())
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");

    const newField: CustomEntityField = {
      id: `f_${Date.now()}`,
      name: cleanName,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      options:
        fieldType === "select" && fieldOptions.trim()
          ? fieldOptions
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : undefined,
    };

    setEntityFields([...entityFields, newField]);
    setFieldLabel("");
    setFieldName("");
    setFieldOptions("");
    setFieldRequired(false);
  };

  const handleSaveNewEntity = async () => {
    if (!newEntityName.trim()) {
      toast.error("Entity name is required.");
      return;
    }
    const code = (newEntityCode.trim() || newEntityName.trim())
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, "_");

    const created = await addEntity({
      code,
      name: newEntityName.trim(),
      category: newEntityCategory,
      description: newEntityDesc.trim(),
      fields: entityFields,
      isActive: true,
    });
    if (!created) return;

    setSelectedEntityId(created.id);
    setIsNewEntityModalOpen(false);
    setNewEntityName("");
    setNewEntityCode("");
    setNewEntityDesc("");
    setEntityFields([]);
  };

  const handleSaveRecord = async () => {
    if (!recordName.trim()) {
      toast.error("Primary name is required.");
      return;
    }
    if (!activeEntity) return;

    const created = await addRecord(activeEntity.id, {
      primaryName: recordName.trim(),
      phone: recordPhone.trim() || undefined,
      email: recordEmail.trim() || undefined,
      attributes: recordAttributes,
    });
    if (!created) return;

    setIsRecordModalOpen(false);
    setRecordName("");
    setRecordPhone("");
    setRecordEmail("");
    setRecordAttributes({});
  };

  const filteredRecords = records.filter(
    (r) =>
      r.entityCode === activeEntity?.code &&
      (r.primaryName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.recordCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.phone && r.phone.includes(searchQuery))),
  );

  if (!hydrated && loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading custom entities…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <Card className="p-5 border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-transparent to-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                Custom Business Entities & Record Types
                <Badge
                  variant="outline"
                  className="text-[10px] text-amber-600 border-amber-500/30 bg-amber-500/10"
                >
                  Zero Developer Dependency
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Define bespoke business record types (e.g. Stone Contractors, Assayers, Escorts)
                with dedicated fields, forms, and searchability.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setNewEntityName("");
              setNewEntityCode("");
              setNewEntityDesc("");
              setEntityFields([]);
              setIsNewEntityModalOpen(true);
            }}
            className="h-8 text-xs gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Define New Entity Type
          </Button>
        </div>
      </Card>

      {/* Entity Selector Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {entities.map((ent) => (
          <Button
            key={ent.id}
            variant={selectedEntityId === ent.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedEntityId(ent.id)}
            className={`text-xs h-8 ${
              selectedEntityId === ent.id
                ? "bg-amber-500 text-black font-semibold hover:bg-amber-600"
                : ""
            }`}
          >
            <Building2 className="h-3.5 w-3.5 mr-1.5" />
            {ent.name} ({records.filter((r) => r.entityCode === ent.code).length})
          </Button>
        ))}
      </div>

      {/* Active Entity Workspace */}
      {activeEntity && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Entity Schema Specification */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h4 className="font-bold text-sm text-foreground">{activeEntity.name}</h4>
                <span className="text-[11px] font-mono text-amber-600">
                  code: {activeEntity.code}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] capitalize">
                {activeEntity.category}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{activeEntity.description}</p>

            <div className="space-y-2 pt-2">
              <Label className="text-xs font-semibold">
                Configured Custom Attributes ({activeEntity.fields.length})
              </Label>
              <div className="rounded-md border divide-y text-xs">
                {activeEntity.fields.map((f) => (
                  <div key={f.id} className="p-2 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-foreground">{f.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {f.name} · {f.type} {f.required && "· [Mandatory]"}
                      </div>
                    </div>
                    {f.options && (
                      <Badge variant="secondary" className="text-[9px]">
                        {f.options.length} options
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Right: Live Entity Records Registry */}
          <Card className="lg:col-span-2 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={`Search ${activeEntity.name} records...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setRecordName("");
                  setRecordPhone("");
                  setRecordEmail("");
                  setRecordAttributes({});
                  setIsRecordModalOpen(true);
                }}
                className="h-8 text-xs gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Add {activeEntity.name}
              </Button>
            </div>

            {/* Records List */}
            <div className="rounded-md border divide-y text-xs">
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground italic">
                  No {activeEntity.name} records found. Click &quot;Add {activeEntity.name}&quot; to
                  create one.
                </div>
              ) : (
                filteredRecords.map((rec) => (
                  <div key={rec.id} className="p-3 hover:bg-muted/20 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                          {rec.primaryName}
                          <span className="text-xs font-mono font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {rec.recordCode}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-muted-foreground text-[11px] mt-1">
                          {rec.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {rec.phone}
                            </span>
                          )}
                          {rec.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {rec.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Custom Attributes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/40 text-[11px]">
                      {Object.entries(rec.attributes).map(([k, v]) => {
                        const fieldDef = activeEntity.fields.find((f) => f.name === k);
                        return (
                          <div key={k} className="p-1.5 rounded bg-muted/30">
                            <span className="text-[10px] text-muted-foreground block">
                              {fieldDef?.label || k}:
                            </span>
                            <span className="font-medium text-foreground">
                              {typeof v === "number" && k.includes("balance")
                                ? `₹${(v / 100).toLocaleString("en-IN")}`
                                : String(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Modal: Create New Custom Entity Type ──────────────────────── */}
      <Dialog open={isNewEntityModalOpen} onOpenChange={setIsNewEntityModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-amber-500" />
              Define New Custom Business Record Type
            </DialogTitle>
            <DialogDescription className="text-xs">
              Create a bespoke entity model for external contractors, specialized workers, or trade
              partners.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Entity Type Name *</Label>
                <Input
                  placeholder="e.g. Diamond Laser Engraver"
                  value={newEntityName}
                  onChange={(e) => {
                    setNewEntityName(e.target.value);
                    setNewEntityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"));
                  }}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">System Code</Label>
                <Input
                  placeholder="e.g. LASER_ENGRAVER"
                  value={newEntityCode}
                  onChange={(e) =>
                    setNewEntityCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "_"))
                  }
                  className="h-8 text-xs font-mono mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Explain the role of this entity in your operations..."
                value={newEntityDesc}
                onChange={(e) => setNewEntityDesc(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* Custom Field Subform */}
            <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
              <Label className="text-xs font-semibold">Add Custom Entity Attributes</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Field Label (e.g. Inscription Rate)"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  className="h-8 text-xs"
                />
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="text">Text (Single Line)</option>
                  <option value="number">Number / Amount</option>
                  <option value="date">Date</option>
                  <option value="select">Dropdown Select</option>
                  <option value="boolean">Checkbox</option>
                  <option value="textarea">Notes / Paragraph</option>
                </select>
                <Button size="sm" onClick={handleAddFieldToDraft} className="h-8 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Add Attribute
                </Button>
              </div>

              {fieldType === "select" && (
                <Input
                  placeholder="Comma-separated options (e.g. Option A, Option B)"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  className="h-8 text-xs"
                />
              )}

              {/* Draft Fields List */}
              {entityFields.length > 0 && (
                <div className="rounded border divide-y text-[11px] bg-card">
                  {entityFields.map((f, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between">
                      <span className="font-medium">
                        {f.label} ({f.type})
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEntityFields(entityFields.filter((_, i) => i !== idx))}
                        className="h-5 w-5 p-0 text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsNewEntityModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveNewEntity}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Publish Entity Type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Add Record to Active Entity ───────────────────────────── */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Plus className="h-5 w-5 text-amber-500" />
              New {activeEntity?.name} Record
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs">Primary Name / Firm Name *</Label>
              <Input
                placeholder="e.g. Rajesh Diamond Works"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Mobile Number</Label>
              <Input
                placeholder="+91 98000 00000"
                value={recordPhone}
                onChange={(e) => setRecordPhone(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Email Address</Label>
              <Input
                placeholder="contractor@email.com"
                value={recordEmail}
                onChange={(e) => setRecordEmail(e.target.value)}
                className="h-8 text-xs mt-1"
              />
            </div>

            {/* Dynamic Custom Fields of this entity */}
            {activeEntity?.fields.map((f) => (
              <div key={f.id} className="pt-1">
                <Label className="text-xs">
                  {f.label} {f.required && "*"}
                </Label>
                {f.type === "select" && f.options ? (
                  <select
                    value={recordAttributes[f.name] || ""}
                    onChange={(e) =>
                      setRecordAttributes({ ...recordAttributes, [f.name]: e.target.value })
                    }
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs mt-1"
                  >
                    <option value="">Select option...</option>
                    {f.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : f.type === "number" ? (
                  <Input
                    type="number"
                    value={recordAttributes[f.name] || ""}
                    onChange={(e) =>
                      setRecordAttributes({
                        ...recordAttributes,
                        [f.name]: parseFloat(e.target.value || "0"),
                      })
                    }
                    className="h-8 text-xs mt-1"
                  />
                ) : (
                  <Input
                    type="text"
                    value={recordAttributes[f.name] || ""}
                    onChange={(e) =>
                      setRecordAttributes({ ...recordAttributes, [f.name]: e.target.value })
                    }
                    className="h-8 text-xs mt-1"
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRecordModalOpen(false)}
              className="text-xs h-8"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRecord}
              className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            >
              Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
