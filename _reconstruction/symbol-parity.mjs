import fs from "fs";

const shopParts = [];
for (const f of fs.readdirSync("production-dist-shop/assets")) {
  if (f.endsWith(".js")) {
    shopParts.push(fs.readFileSync(`production-dist-shop/assets/${f}`, "utf8"));
  }
}
const shop = shopParts.join("\n");

const distParts = [];
if (fs.existsSync("dist/assets")) {
  for (const f of fs.readdirSync("dist/assets")) {
    if (f.endsWith(".js")) {
      distParts.push(fs.readFileSync(`dist/assets/${f}`, "utf8"));
    }
  }
}
const dist = distParts.join("\n");

const srcParts = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${ent.name}`;
    if (ent.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(ent.name)) srcParts.push(fs.readFileSync(p, "utf8"));
  }
}
walk("src");
const src = srcParts.join("\n");

const syms = [
  "assertVaultGoldIssueAvailable",
  "assertTransactionGoldIssueFromLedger",
  "assertMaterialIssueStock",
  "mint_invoice_verification",
  "verify_public_document",
  "register_document_verification",
  "GOLD_WEIGHT_MATERIALS",
  "requireVaultStockLine",
  "get_gold_ledger_page",
  "get_company_cash_ledger_page",
  "rpc_post_universal_transaction",
  "ensureInvoiceVerification",
  "verifyPublicDocument",
];

for (const s of syms) {
  const esc = s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(esc, "g");
  const sc = (shop.match(re) || []).length;
  const dc = (dist.match(re) || []).length;
  const xc = (src.match(re) || []).length;
  const mark = sc === dc ? "OK" : dc === 0 && sc > 0 ? "MISS_DIST" : "DIFF";
  console.log(`${s}: shop=${sc} dist=${dc} src=${xc} ${mark}`);
}
