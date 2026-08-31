import fs from "fs";
import path from "path";

const shopDir = "C:/final erp 29.08/new and final/production-dist-shop/assets";
const extract =
  "C:/Users/aritr/Downloads/Jewellery/AVS-FULL-SOURCE-EXTRACT/01-online-avs-ornexa";

const pairs = [
  ["mobile.business-Dh3MMY_w.js", "src/routes/mobile.business.tsx"],
  ["mobile.gold-stock-B2Cdg-d0.js", "src/routes/mobile.gold-stock.tsx"],
  ["mobile.more-aTgrKsmR.js", "src/routes/mobile.more.tsx"],
  ["mobile.reports-BoFtEEy1.js", "src/routes/mobile.reports.tsx"],
  ["mobile.sync-COCXUr5r.js", "src/routes/mobile.sync.tsx"],
  ["mobile.work-6ElCDIVm.js", "src/routes/mobile.work.tsx"],
  ["MobileCameraCapture-C64opgfN.js", "src/components/mobile/MobileCameraCapture.tsx"],
  ["MobileContextualActions-W_69n5JE.js", "src/components/mobile/MobileContextualActions.tsx"],
  ["MobilePageScaffold--EvKBCwu.js", "src/components/mobile/MobilePageScaffold.tsx"],
  ["mobile-table-stamp-Cnkx_ERs.js", "src/lib/native/mobile-table-stamp.ts"],
  ["portal-access-service-CHopwnPo.js", "src/lib/portal/portal-access-service.ts"],
  ["portal-action-rpcs-Bmy_vzhh.js", "src/lib/portal/portal-action-rpcs.ts"],
  ["PortalKycPanel-B_7z_yAP.js", "src/components/portal/PortalKycPanel.tsx"],
  ["portal-offline-cache-Csg28aq5.js", "src/lib/portal/portal-offline-cache.ts"],
  ["portal-scope-store-DhzdlTx4.js", "src/lib/portal/portal-scope-store.ts"],
];

function tokens(s) {
  const out = new Set();
  for (const m of s.matchAll(/[A-Za-z_][A-Za-z0-9_]{4,}/g)) out.add(m[0]);
  return out;
}

for (const [shopFile, srcRel] of pairs) {
  const sp = path.join(shopDir, shopFile);
  const ep = path.join(extract, srcRel);
  const shopExists = fs.existsSync(sp);
  const srcExists = fs.existsSync(ep);
  if (!shopExists || !srcExists) {
    console.log(`NOFILE ${srcRel} shop=${shopExists} extract=${srcExists}`);
    continue;
  }
  const st = tokens(fs.readFileSync(sp, "utf8"));
  const et = tokens(fs.readFileSync(ep, "utf8"));
  let inter = 0;
  for (const t of et) if (st.has(t)) inter++;
  const ratio = et.size ? inter / et.size : 0;
  const exportNames = [...et]
    .filter((t) => /^(use|get|set|assert|mark|create|Mobile|Portal|fetch|load|save)/.test(t))
    .slice(0, 20);
  const hit = exportNames.filter((t) => st.has(t));
  console.log(
    `${(ratio * 100).toFixed(0)}% ${srcRel} | key ${hit.length}/${exportNames.length} :: ${hit.slice(0, 8).join(",")}`,
  );
}
