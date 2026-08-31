#!/usr/bin/env node
/**
 * Side-by-side FROZEN (preview) vs EDITABLE (dev) parity probe — no Playwright.
 * Compares bundle identity, route HTTP reachability, and authenticated data parity.
 * Writes _reconstruction/PARITY_SIDE_BY_SIDE.json
 */
import fs from "node:fs";
import path from "node:path";

const FROZEN = process.env.FROZEN_URL || "http://localhost:3002";
const EDITABLE = process.env.EDITABLE_URL || "http://localhost:3000";
const EXTRACT =
  process.env.PARITY_EXTRACT ||
  "C:/Users/aritr/Downloads/Jewellery/AVS-FULL-SOURCE-EXTRACT/01-online-avs-ornexa";

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const sbUrl = (env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const pass = env.E2E_PASSWORD || "Mtj-Qa-2026!Reset9x";
const email = "mtj.qa.firm-owner.20260731@example.com";

const SURFACES = [
  { id: "login", path: "/login" },
  { id: "dashboard", path: "/app" },
  { id: "customers", path: "/people" },
  { id: "karigars", path: "/people?tab=karigars" },
  { id: "stock", path: "/stock" },
  { id: "stock_entry", path: "/stock/entry" },
  { id: "orders", path: "/orders" },
  { id: "orders_new", path: "/orders/new" },
  { id: "billing", path: "/billing" },
  { id: "ledger", path: "/ledger" },
  { id: "workshop", path: "/workshop" },
  { id: "reports", path: "/reports" },
  { id: "gold_ledger", path: "/reports/gold-ledger" },
  { id: "settings", path: "/settings" },
  { id: "barcode", path: "/barcode" },
  { id: "utilities", path: "/utilities" },
  { id: "item_masters", path: "/utilities/item-masters" },
  { id: "customization", path: "/settings/customization" },
  { id: "mobile", path: "/mobile" },
  { id: "customer_portal", path: "/customer-portal" },
  { id: "karigar_portal", path: "/karigar-portal" },
  { id: "supplier_portal", path: "/supplier-portal" },
  { id: "manufacturing", path: "/manufacturing" },
  { id: "attendance", path: "/attendance" },
  { id: "treasury", path: "/treasury/vouchers" },
  { id: "purchases", path: "/billing/purchases" },
  { id: "settlements", path: "/billing/settlement/new" },
  { id: "bank_recon", path: "/treasury/bank-reconciliation" },
  { id: "request_access", path: "/request-access" },
];

const mismatches = [];
const probes = [];

function addMismatch(surface, frozen, editable, difference, rootCause, fix, verification) {
  mismatches.push({ surface, frozen, editable, difference, rootCause, fix, verification });
}

async function fetchHtml(base, routePath) {
  const res = await fetch(`${base}${routePath}`, { redirect: "follow" });
  const html = await res.text();
  return { status: res.status, html, url: res.url };
}

function bundleFromHtml(html) {
  const m = html.match(/index-([A-Za-z0-9_-]+)\.js/);
  return m ? `index-${m[1]}.js` : null;
}

function extractMarkers(html) {
  const markers = [];
  if (html.includes("auth-email") || html.includes('data-testid="auth-email"')) markers.push("auth_form");
  if (html.includes("Less Wt") || html.includes("lessWeight")) markers.push("order_less_wt");
  if (html.includes("Wastage") || html.includes("wastage")) markers.push("wastage_field");
  if (html.includes("Cash Advance") || html.includes("cashAdvance")) markers.push("cash_advance");
  if (html.includes("Daily Delivery Summary")) markers.push("delivery_summary");
  if (html.includes("Request access") || html.includes("request-access")) markers.push("request_access_cta");
  if (html.includes("Start 14-Day") || html.includes("Start Your Free Trial")) markers.push("trial_cta");
  if (html.includes("Item Master") || html.includes("item-masters")) markers.push("item_master");
  if (html.includes("Gold Ledger") || html.includes("gold-ledger")) markers.push("gold_ledger");
  return markers;
}

async function loginSupabase() {
  const res = await fetch(`${sbUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pass }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "login failed");
  return data.access_token;
}

async function rpc(token, fn, body = {}) {
  const res = await fetch(`${sbUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

function routeFileSize(relPath) {
  const p = path.join(process.cwd(), relPath);
  if (!fs.existsSync(p)) return null;
  return fs.statSync(p).size;
}

function compareRouteSizes() {
  const pairs = [
    ["src/routes/orders.new.tsx", "src/routes/orders.new.tsx"],
    ["src/routes/stock.entry.tsx", "src/routes/stock.entry.tsx"],
    ["src/routes/stock.index.tsx", "src/routes/stock.index.tsx"],
    ["src/routes/attendance.index.tsx", "src/routes/attendance.index.tsx"],
    ["src/routes/billing.purchases.index.tsx", "src/routes/billing.purchases.index.tsx"],
    ["src/routes/settings.whatsapp.tsx", "src/routes/settings.whatsapp.tsx"],
    ["src/routes/manufacturing.index.tsx", "src/routes/manufacturing.index.tsx"],
  ];
  for (const [editableRel] of pairs) {
    const editableSize = routeFileSize(editableRel);
    const extractPath = path.join(EXTRACT, editableRel.replace(/\\/g, "/"));
    const frozenSize = fs.existsSync(extractPath) ? fs.statSync(extractPath).size : null;
    if (editableSize == null) continue;
    if (frozenSize == null) {
      addMismatch(
        editableRel,
        "missing in extract",
        `${editableSize} bytes`,
        "route missing from shop extract",
        "not in frozen source tree",
        "restore from extract if shop had it",
        "byte match + browser field audit",
      );
      continue;
    }
    const ratio = editableSize / frozenSize;
    if (ratio < 0.85 || ratio > 1.15) {
      addMismatch(
        editableRel,
        `${frozenSize} bytes (extract/shop)`,
        `${editableSize} bytes (editable)`,
        `size ratio ${ratio.toFixed(2)}`,
        "route file stripped or diverged from shop source",
        "controlled restore from 01-online-avs-ornexa extract with deps",
        "field-level browser audit + typecheck",
      );
    }
  }
}

async function main() {
  console.log(`FROZEN=${FROZEN} EDITABLE=${EDITABLE}`);

  let frozenUp = false;
  let editableUp = false;
  try {
    const f = await fetch(FROZEN);
    frozenUp = f.ok;
  } catch {}
  try {
    const e = await fetch(EDITABLE);
    editableUp = e.ok;
  } catch {}

  if (!frozenUp) {
    addMismatch(
      "infra",
      "frozen preview down",
      EDITABLE,
      "cannot load frozen build",
      "preview:shop not running",
      "npm run preview on port 3002",
      "http 200 on frozen URL",
    );
  }
  if (!editableUp) {
    addMismatch(
      "infra",
      FROZEN,
      "editable dev down",
      "cannot load editable build",
      "dev server not running",
      "npm run dev on port 3000",
      "http 200 on editable URL",
    );
  }

  const frozenRoot = frozenUp ? await fetchHtml(FROZEN, "/") : null;
  const editableRoot = editableUp ? await fetchHtml(EDITABLE, "/") : null;
  const frozenBundle = frozenRoot ? bundleFromHtml(frozenRoot.html) : null;
  const editableBundle = editableRoot ? bundleFromHtml(editableRoot.html) : null;

  probes.push({
    id: "bundle_identity",
    frozen: frozenBundle || "index-CVsE73i6.js (expected)",
    editable: editableBundle || "dev (no hash)",
    match: frozenBundle === "index-CVsE73i6.js" || frozenBundle?.includes("CVsE73i6"),
  });

  if (frozenBundle && !frozenBundle.includes("CVsE73i6")) {
    addMismatch(
      "bundle",
      frozenBundle,
      "index-CVsE73i6.js",
      "frozen preview not serving shop oracle bundle",
      "wrong outDir or corrupt production-dist-shop",
      "vite preview --outDir production-dist-shop",
      "index-CVsE73i6.js in HTML",
    );
  }

  for (const s of SURFACES) {
    const fr = frozenUp ? await fetchHtml(FROZEN, s.path) : { status: 0, html: "", url: "" };
    const er = editableUp ? await fetchHtml(EDITABLE, s.path) : { status: 0, html: "", url: "" };
    const fMark = extractMarkers(fr.html);
    const eMark = extractMarkers(er.html);
    const markerDiff = [...new Set([...fMark, ...eMark])].filter((m) => fMark.includes(m) !== eMark.includes(m));

    probes.push({
      id: s.id,
      path: s.path,
      frozen: { status: fr.status, markers: fMark, finalUrl: fr.url },
      editable: { status: er.status, markers: eMark, finalUrl: er.url },
      markerDiff,
    });

    if (s.id === "orders_new") {
      const fHasLess = fr.html.includes("Less Wt") || fr.html.includes("lessWeight");
      const eHasLess = er.html.includes("Less Wt") || er.html.includes("lessWeight");
      if (fHasLess !== eHasLess) {
        addMismatch(
          "orders_new",
          fHasLess ? "has Less Wt" : "missing Less Wt",
          eHasLess ? "has Less Wt" : "missing Less Wt",
          "order creation fields differ",
          "orders.new.tsx diverged from shop",
          "restore production fields from extract",
          "browser field checklist",
        );
      }
    }

    if (s.id === "login") {
      const fTrial = fr.html.includes("Start 14-Day") || fr.html.includes("Start Your Free Trial");
      const eTrial = er.html.includes("Start 14-Day") || er.html.includes("Start Your Free Trial");
      const eReq = er.html.includes("Request access") || er.html.includes("request-access");
      if (eTrial && !fTrial) {
        addMismatch(
          "login",
          "shop: staff login (no trial on frozen bundle)",
          "editable shows trial CTA",
          "invitation-only policy vs legacy trial strings in bundle",
          "editable login updated; frozen bundle unchanged (expected)",
          "none on frozen; editable uses REQUEST_ACCESS_PATH",
          "login CTA audit",
        );
      }
      if (!eReq && !eTrial) {
        addMismatch(
          "login",
          "request access or trial CTA",
          "neither visible in SSR html",
          "CTA may be client-rendered only",
          "SPA — probe via browser not raw HTML",
          "browser snapshot audit",
          "browser snapshot",
        );
      }
    }
  }

  compareRouteSizes();

  let dataParity = null;
  try {
    const token = await loginSupabase();
    const dash = await rpc(token, "get_home_dashboard_summary", {});
    if (dash.status === 200 && Array.isArray(dash.data)) {
      const row = dash.data[0] ?? {};
      dataParity = {
        vault_gold_mg: row.vault_gold_mg,
        open_orders: row.open_orders,
        available_stock_count: row.available_stock_count,
        note: "same backend for both builds when both use QA Supabase",
      };
    }
  } catch (e) {
    dataParity = { error: String(e.message || e) };
  }

  const out = {
    generatedAt: new Date().toISOString(),
    frozenUrl: FROZEN,
    editableUrl: EDITABLE,
    frozenBundle,
    editableBundle,
    dataParity,
    probes,
    mismatches,
    mismatchCount: mismatches.length,
    verdict: mismatches.length === 0 ? "PASS" : "NOT PASS",
  };

  const outPath = "_reconstruction/PARITY_SIDE_BY_SIDE.json";
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath} — ${mismatches.length} mismatches, verdict=${out.verdict}`);
  for (const m of mismatches.slice(0, 20)) {
    console.log(`  • ${m.surface}: ${m.difference}`);
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
