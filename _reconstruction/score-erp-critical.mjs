import fs from "fs";
import path from "path";

const shopDir = "production-dist-shop/assets";
const extract =
  "C:/Users/aritr/Downloads/Jewellery/AVS-FULL-SOURCE-EXTRACT/01-online-avs-ornexa";
const srcRoot = "src";

function stripHash(name) {
  const m = name.match(/^(.*)-([A-Za-z0-9_-]{6,12})\.js$/);
  return m ? m[1] : name.replace(/\.js$/, "");
}

function tokens(s) {
  const out = new Set();
  for (const m of s.matchAll(/[A-Za-z_][A-Za-z0-9_]{4,}/g)) out.add(m[0]);
  return out;
}

function score(shopText, srcText) {
  const st = tokens(shopText);
  const et = tokens(srcText);
  let inter = 0;
  for (const t of et) if (st.has(t)) inter++;
  return {
    ratio: et.size ? inter / et.size : 0,
    shopOnly: [...st].filter((t) => !et.has(t)).length,
    srcOnly: [...et].filter((t) => !st.has(t)).length,
    keyHits: [...et]
      .filter((t) =>
        /^(assert|ensure|mint|verify|get_|fetch|calculate|GOLD_|require|post_|rpc_)/.test(t),
      )
      .filter((t) => st.has(t)),
  };
}

const pairs = [
  ["vault-gold-stock", "src/lib/vault-gold-stock.ts"],
  ["VaultGoldStockSelect", "src/components/VaultGoldStockSelect.tsx"],
  ["transaction-ledger-guards", "src/lib/transaction-ledger-guards.ts"],
  ["invoice-due", "src/lib/invoice-due.ts"],
  ["material-issue-stock", "src/lib/material-issue-stock.ts"],
  ["document-verification", "src/lib/document-verification.ts"],
  ["invoice-payment-status", "src/lib/invoice-payment-status.ts"],
  ["ledger-pagination", "src/lib/ledger-pagination.ts"],
  ["branch-scope", "src/lib/branch-scope.ts"],
  ["firm-scoped-app-settings", "src/lib/firm-scoped-app-settings.ts"],
  ["BillingModule", "src/modules/billing/BillingModule.tsx"],
  ["billing-store", "src/lib/billing-store.ts"],
  ["ledger-store", "src/lib/ledger-store.ts"],
  ["material-vault-store", "src/lib/material-vault-store.ts"],
  ["material-vault-sync", "src/lib/material-vault-sync.ts"],
  ["PrintEngine", "src/lib/print-engine/PrintEngine.tsx"],
  ["auth-gate", "src/components/auth-gate.tsx"],
  ["invoice-data", "src/lib/invoice-data.ts"],
];

const shopFiles = fs.readdirSync(shopDir).filter((f) => f.endsWith(".js"));
const byBase = new Map();
for (const f of shopFiles) {
  const b = stripHash(f);
  if (!byBase.has(b)) byBase.set(b, f);
}

const rows = [];
for (const [base, rel] of pairs) {
  const shopFile = byBase.get(base);
  const srcPath = path.join(srcRoot, rel.replace(/^src\//, ""));
  const extractPath = path.join(extract, rel);
  if (!shopFile) {
    rows.push({ base, status: "NO_SHOP_CHUNK" });
    continue;
  }
  const shopText = fs.readFileSync(path.join(shopDir, shopFile), "utf8");
  const srcExists = fs.existsSync(srcPath);
  const extExists = fs.existsSync(extractPath);
  const srcText = srcExists ? fs.readFileSync(srcPath, "utf8") : "";
  const extText = extExists ? fs.readFileSync(extractPath, "utf8") : "";
  const vsSrc = srcExists ? score(shopText, srcText) : null;
  const vsExt = extExists ? score(shopText, extText) : null;
  const prefer =
    vsExt && vsSrc
      ? vsExt.ratio > vsSrc.ratio + 0.03
        ? "EXTRACT"
        : "SRC_OK"
      : vsExt
        ? "EXTRACT_ONLY"
        : srcExists
          ? "SRC_ONLY"
          : "MISSING";
  rows.push({
    base,
    shop: shopFile,
    shopBytes: shopText.length,
    srcBytes: srcText.length,
    extractBytes: extText.length,
    srcPct: vsSrc ? Math.round(vsSrc.ratio * 100) : null,
    extractPct: vsExt ? Math.round(vsExt.ratio * 100) : null,
    prefer,
    keyHits: (vsSrc?.keyHits || []).slice(0, 8).join(","),
  });
}

console.log(JSON.stringify(rows, null, 2));
fs.writeFileSync(
  "_reconstruction/erp-critical-score.json",
  JSON.stringify(rows, null, 2),
);
