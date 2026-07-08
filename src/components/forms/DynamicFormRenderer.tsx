import { useState } from "react";
import { FormFieldMetadata, FormMetadata } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
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

interface DynamicFormRendererProps {
  formMeta: FormMetadata;
  initialData?: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
}

export function DynamicFormRenderer({ formMeta, initialData = {}, onSave }: DynamicFormRendererProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formMeta.fields.map((field: FormFieldMetadata) => {
        const val = formData[field.name] ?? field.defaultValue ?? "";

        return (
          <div key={field.name} className="space-y-1">
            <Label>
              {field.label} {field.required && <span className="text-destructive">*</span>}
            </Label>
            
            {field.type === "text" && (
              <Input
                required={field.required}
                value={val}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            )}
            
            {field.type === "number" && (
              <Input
                type="number"
                required={field.required}
                value={val}
                onChange={(e) => handleChange(field.name, Number(e.target.value))}
              />
            )}

            {field.type === "textarea" && (
              <Textarea
                required={field.required}
                value={val}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            )}

            {field.type === "boolean" && (
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={!!formData[field.name]}
                  onCheckedChange={(c) => handleChange(field.name, c)}
                />
                <span className="text-sm text-muted-foreground">Yes / No</span>
              </div>
            )}

            {field.type === "date" && (
              <Input
                type="date"
                required={field.required}
                value={val}
                onChange={(e) => handleChange(field.name, e.target.value)}
              />
            )}

            {field.type === "select" && field.options && (
              <Select
                value={val}
                onValueChange={(v) => handleChange(field.name, v)}
              >
                <SelectTrigger>
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

      <Button type="submit" className="w-full">
        Save Form
      </Button>
    </form>
  );
}
