import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Printer, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents · MTW Workshop ERP" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader title="Documents" subtitle="Centralized printing and document verification." />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-gold" /> Workshop documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Invoices, gold issue/return slips, party books, and reports use the shared browser
              print workflow.
            </p>
            <Link className="text-gold underline" to="/billing">
              Open Billing
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gold" /> Verify document
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Verify a printed workshop document using its QR code or document number.</p>
            <Link className="text-gold underline" to="/verify">
              Open Verification
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
