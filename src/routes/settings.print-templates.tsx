/**
 * Settings Route: /settings/print-templates
 * Visual Document Template Designer & Safe Block Customizer
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { DocumentTemplateDesigner } from "@/components/customization/DocumentTemplateDesigner";

export const Route = createFileRoute("/settings/print-templates")({
  head: () => ({ meta: [{ title: "Print Templates - AVS Gold ERP" }] }),
  component: PrintTemplatesPage,
});

function PrintTemplatesPage() {
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Document & Print Templates"
          subtitle="Visual layout designer, 10 base template families, and safe component block configurations."
        />
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/control/customization">
            <ArrowLeft className="h-4 w-4" /> Back to Customization Hub
          </Link>
        </Button>
      </div>

      <DocumentTemplateDesigner />
    </div>
  );
}
