import { useState } from "react";
import { FormMetadata } from "@/lib/settings-store";
import { Button } from "@/components/ui/button";
import { DynamicFields } from "./DynamicFields";

interface DynamicFormRendererProps {
  formMeta: FormMetadata;
  initialData?: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
}

/** Standalone version: the shared fields plus its own submit. */
export function DynamicFormRenderer({
  formMeta,
  initialData = {},
  onSave,
}: DynamicFormRendererProps) {
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
      <DynamicFields fields={formMeta.fields} values={formData} onChange={handleChange} />

      <Button type="submit" className="w-full">
        Save Form
      </Button>
    </form>
  );
}
