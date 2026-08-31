import { FormFieldMetadata, FormMetadata } from "@/lib/settings-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

/**
 * The custom-field inputs on their own — controlled, and with no <form> or submit
 * button of its own so it can be dropped inside a host form (the People dialog)
 * that owns the saving. DynamicFormRenderer wraps this for the standalone case;
 * both render from the same definitions, so a field added in Settings looks and
 * behaves identically wherever it appears.
 */
export function DynamicFields({
  fields,
  values,
  onChange,
  idPrefix,
}: {
  fields: FormFieldMetadata[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
  idPrefix?: string;
}) {
  return (
    <>
      {fields.map((field: FormFieldMetadata) => {
        const val = values[field.name] ?? field.defaultValue ?? "";
        const testId = `${idPrefix ? `${idPrefix}-` : ""}custom-field-${field.name}`;

        return (
          <div key={field.name} className="grid gap-2">
            <Label>
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>

            {field.type === "text" && (
              <Input
                data-testid={testId}
                required={field.required}
                value={val}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}

            {field.type === "number" && (
              <Input
                data-testid={testId}
                type="number"
                required={field.required}
                value={val}
                onChange={(e) =>
                  onChange(field.name, e.target.value === "" ? "" : Number(e.target.value))
                }
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                data-testid={testId}
                required={field.required}
                value={val}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}

            {field.type === "boolean" && (
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  data-testid={testId}
                  checked={!!values[field.name]}
                  onCheckedChange={(c) => onChange(field.name, c)}
                />
                <span className="text-sm text-muted-foreground">Yes / No</span>
              </div>
            )}

            {field.type === "date" && (
              <Input
                data-testid={testId}
                type="date"
                required={field.required}
                value={val}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}

            {field.type === "select" && field.options && (
              <Select value={val} onValueChange={(v) => onChange(field.name, v)}>
                <SelectTrigger data-testid={testId}>
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );
      })}
    </>
  );
}

/**
 * Person properties the built-in People form already collects. A form definition
 * (notably the seeded "Customer KYC Form") may redeclare these — rendering them
 * inline would show the operator two boxes for the same fact, and enforcing their
 * `required` flag a second time would make a valid person unsaveable. The
 * built-in field stays authoritative; the duplicate is dropped.
 */
const BUILT_IN_PERSON_FIELDS = new Set([
  "fullName",
  "phone",
  "altPhone",
  "email",
  "address",
  "currentAddress",
  "permanentAddress",
  "villageCity",
  "state",
  "aadhaar",
  "pan",
  "gstin",
  "workType",
  "joiningDate",
  "dob",
  "dateOfBirth",
  "anniversary",
  "notes",
]);

/** The genuinely-custom fields of a form — i.e. those not already on the People form. */
export function customFieldsOf(form: FormMetadata): FormFieldMetadata[] {
  return form.fields.filter((f) => !BUILT_IN_PERSON_FIELDS.has(f.name));
}

/**
 * The forms whose fields belong on a Person, each reduced to its custom fields,
 * with any form that adds nothing new dropped entirely. Single definition so the
 * People form, search, and print can never disagree about which fields apply.
 */
export function peopleForms(formsMetadata: FormMetadata[]): FormMetadata[] {
  return formsMetadata
    .filter((f) => f.type === "kyc" || f.type === "custom")
    .map((f) => ({ ...f, fields: customFieldsOf(f) }))
    .filter((f) => f.fields.length > 0);
}

/**
 * Flattens a person's saved custom values into one searchable string. Booleans
 * and empty slots are skipped — matching "false" or "" would be noise.
 */
export function customFormsSearchText(
  customForms: Record<string, Record<string, any>> | undefined,
): string {
  if (!customForms) return "";
  return Object.values(customForms)
    .flatMap((values) => Object.values(values ?? {}))
    .filter((v) => v !== "" && v != null && typeof v !== "boolean")
    .join(" ")
    .toLowerCase();
}
