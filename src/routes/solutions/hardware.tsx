import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";

export const Route = createFileRoute("/solutions/hardware")({
  component: HardwareMarketingPage,
});

function HardwareMarketingPage() {
  return (
    <MarketingLayout>
      <article className="mx-auto max-w-3xl px-4 py-14 space-y-8">
        <h1 className="font-serif text-4xl">Hardware integrations</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          AVS ERP does not invent a proprietary jewellery barcode standard. Shop identity stays
          Code128 by default. EAN-13 and GS1 DataMatrix are available when a firm configures a real
          GS1 company prefix. HUID is jewellery traceability text — never forced into the symbol as
          fake BIS compliance.
        </p>
        <ul className="space-y-3 text-muted-foreground list-disc pl-5 leading-relaxed">
          <li>USB HID scanners and Android / web camera scanning (including DataMatrix).</li>
          <li>TSPL / ZPL jewellery tags with PDF fallback; ESC/POS thermal receipts via WebUSB.</li>
          <li>Desktop Web Serial weighing scales — unstable readings are never auto-accepted.</li>
        </ul>
        <Link className="text-sm underline underline-offset-2" to="/product">
          Back to product
        </Link>
      </article>
    </MarketingLayout>
  );
}
