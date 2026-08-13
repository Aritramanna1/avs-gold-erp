import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/lib/settings-store";
import {
  BookOpen,
  Key,
  Database,
  Users,
  Hammer,
  Printer,
  QrCode,
  ShieldCheck,
  AlertOctagon,
  Scale,
  GitBranch,
} from "lucide-react";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & Pilot Guide · AVS Gold ERP" }] }),
  component: HelpPage,
});

function HelpPage() {
  const firm = useSettings((state) => state.firm);
  const deploymentLabel = "ONLINE";
  const verificationBase =
    firm.website?.replace(/\/$/, "") || "the configured verification address";

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2">
        <PageHeader
          title="AVS ERP Pilot Operating Guide"
          subtitle="Reference manual for this Supabase-online jewellery manufacturing deployment."
        />
        <Badge variant="outline" className="bg-gold/10 text-gold border-gold/40 py-1 px-3">
          ● {deploymentLabel} PILOT ACTIVE
        </Badge>
      </div>

      <Card className="p-6 border-gold/40 bg-gradient-to-r from-gold/5 via-gold/10 to-transparent">
        <div className="flex items-start gap-3">
          <BookOpen className="h-6 w-6 text-gold mt-1 flex-shrink-0" />
          <div>
            <h2 className="font-serif text-lg text-gold font-semibold">Welcome to Jewellers ERP</h2>
            <p className="text-sm mt-1 text-muted-foreground leading-relaxed">
              This installation uses Supabase Auth, Supabase PostgreSQL, RLS, and approved
              Supabase-compatible storage for connected operation.
              <span className="ml-1">
                Manual registers should be kept in parallel during the selected-workshop testing
                period until each workflow has been validated.
              </span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <GuideSection
          icon={<Key className="text-gold h-5 w-5" />}
          title="1. Login & Profile Validation"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every user needs an active Supabase-authenticated account in the configured organization
            directory.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>Active Profile Required:</strong> If you try to log in and see{" "}
              <em>&quot;AVS ERP profile is not linked&quot;</em>, your email is not registered in
              the User Directory. Contact Admin to add your email.
            </li>
            <li>
              <strong>Password Reset:</strong> Passwords are managed through User Management or the
              available sign-in recovery flow for this deployment.
            </li>
            <li>
              <strong>Show/Hide Password:</strong> Use the eye icon in the input field to review
              characters before logging in.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<GitBranch className="text-gold h-5 w-5" />}
          title="2. Multi-Branch Operations"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            The ERP dynamically partitions inventory, billing, expenses, and logbooks by the active
            logged-in branch context.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>Switching Branches:</strong> Go to the Top Navigator to toggle between
              branches if you are authorized as an Admin/Owner.
            </li>
            <li>
              <strong>Branch Partitioning:</strong> Custom rates and localized items are restricted
              to whichever branch is active, preventing accidental crossovers.
            </li>
          </ul>
        </GuideSection>

        <GuideSection icon={<Users className="text-gold h-5 w-5" />} title="3. People & KYC Upload">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Indian compliance requires valid KYC for high-value metal transfers and karigar job
            delegations.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>Documents Required:</strong> Live color photo, Aadhaar front, Aadhaar back,
              and PAN.
            </li>
            <li>
              <strong>Document Storage:</strong>
              <span className="ml-1">
                Documents are saved through the configured Supabase-compatible storage provider.
              </span>
            </li>
            <li>
              <strong>KYC Completeness check:</strong> The system strictly blocks issuing vault gold
              to any karigar who does not have an active photo and both Aadhaar front/back uploaded.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Scale className="text-gold h-5 w-5" />}
          title="4. Stock & Fine Gold Math"
        >
          <p className="text-xs text-muted-foreground leading-relaxed font-mono bg-background/50 p-2.5 rounded border border-border">
            <strong>Formula:</strong> Fine Weight = Gross Weight × (Purity / 1000)
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>The 200g 999 Gold Rule:</strong> If you add 200.000g of 999 purity gold into
              the vault, it represents exactly:
              <br />
              <code className="text-gold">200.000g × 0.999 = 199.800g of Pure Fine Gold</code>.
            </li>
            <li>
              <strong>916 Gold Issue:</strong> If you issue 10.000g of 916 gold to a karigar, it
              represents:
              <br />
              <code>10.000g × 0.916 = 9.160g of Fine Gold</code> debited from the Vault balance.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Hammer className="text-gold h-5 w-5" />}
          title="5. Gold Issue & Overdraft Procedure"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            Vault transfers are strictly managed to keep the physical shop inventory aligned with
            the ERP.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>Standard Issue:</strong> Enter the job number, select the registered karigar,
              specify the weight and purity, and hit confirm.
            </li>
            <li>
              <strong>Gold Vault Overdraft:</strong> If the vault possesses insufficient pure gold
              to release a job, the ERP triggers the <em>MTJ Overdraft Authorization Screen</em>.
            </li>
            <li>
              <strong>Auditing Overdrafts:</strong> To bypass shortage blocks, you must fulfill a
              required <em>Reason for Overdraft</em> and enter the name of the{" "}
              <em>Authorizing Manager</em>. This appends a permanent{" "}
              <code>gold_overdraft_issue</code> traceback to the audit trail.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<Printer className="text-gold h-5 w-5" />}
          title="6. Thermal vs. Inkjet Print Templates"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            Every customer receipt, karigar voucher, and invoice is formatted in multi-style
            layouts.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>Inkjet Layout:</strong> Elegant, full-color A4 desktop copy containing full
              brand listings, bank terms, signature blocks, and corporate details.
            </li>
            <li>
              <strong>Thermal Layout:</strong> Compact, high-density black-and-white 3-inch slip,
              optimizing vertical spacing, removing colors, adding QR codes, and incorporating our
              thermal-fade compliance disclaimer.
            </li>
            <li>
              <strong>In-App Previews:</strong> All print requests generate an interactive frame
              preview inside the ERP, preventing data resets when closing or canceling prints.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<QrCode className="text-gold h-5 w-5" />}
          title="7. QR Scanning & In-Shop Verification"
        >
          <p className="text-xs text-muted-foreground leading-relaxed">
            A high-contrast security QR code is printed on every ticket to prevent counterfeit
            vouchers.
          </p>
          <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
            <li>
              <strong>The Verification Route:</strong> Scanning the QR code points the scanner to{" "}
              <code>{verificationBase}/verify?code=...</code>
            </li>
            <li>
              <strong>Tamper Detection:</strong> The verification portal checks the cryptographic
              checksum of the document against the records available to the active deployment.
            </li>
            <li>
              <strong>Reprint Tracking:</strong> If a ticket has been printed multiple times, the
              verification screen displays a persistent <em>Reprint Count Registry</em> to warning
              shop keepers if a ticket has duplicative copies.
            </li>
          </ul>
        </GuideSection>

        <GuideSection
          icon={<AlertOctagon className="text-gold h-5 w-5" />}
          title="8. Common Errors & Fixes"
        >
          <div className="space-y-3 mt-2 text-xs text-muted-foreground">
            <div>
              <span className="text-rose-400 font-medium">Account Not Permitted / Deactivated</span>
              <p className="mt-0.5">
                The signed-in account is inactive or does not have access to the requested module.
                Ask the Super Owner to review the user and role in User Management.
              </p>
            </div>
            <div>
              <span className="text-rose-400 font-medium font-mono">KYC Incomplete Error</span>
              <p className="mt-0.5">
                Attempting to release metal to a worker with missing records. Ensure they have
                Aadhar Front + Back and Photo uploaded before routing issue.
              </p>
            </div>
          </div>
        </GuideSection>
      </div>

      <Card className="p-6 border-gold/20 bg-card">
        <h3 className="font-serif text-base text-gold mb-3 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-500" /> Compliance Disclaimer &amp;
          Verification
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This system complies with the Gold Hallmarking &amp; GST guidelines of India for jewellery
          manufacturing operations. All overdrafts are logged as potential loss audit lines. Ensure
          you run a <strong>Daily Close</strong> at the end of each physical business day to commit
          branch balances to the permanent database.
        </p>
      </Card>
    </div>
  );
}

function GuideSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 border-border bg-card/40 hover:border-gold/30 transition-colors">
      <h3 className="font-serif text-sm font-semibold text-gold mb-3 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </Card>
  );
}
