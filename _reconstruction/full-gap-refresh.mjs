import fs from "fs";
import path from "path";

function stripHash(name) {
  const m = name.match(/^(.*)-([A-Za-z0-9_-]{6,14})\.js$/);
  return m ? m[1] : name.replace(/\.js$/, "");
}
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!["node_modules", "dist", ".git"].includes(e.name)) walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(e.name)) acc.push(p);
  }
  return acc;
}
function normShop(b) {
  return b
    .replace(/\._id/g, "$id")
    .replace(/\._kind/g, "$kind")
    .replace(/\._token/g, "$token")
    .replace(/\._jobId/g, "$jobId")
    .replace(/\._variant/g, "$variant")
    .replace(/\._docType/g, "$docType")
    .replace(/-$/, "");
}

const shopBases = new Map();
for (const f of fs.readdirSync("production-dist-shop/assets")) {
  if (!f.endsWith(".js")) continue;
  const base = stripHash(f);
  shopBases.set(base, f);
}

const srcFiles = walk("src");
const srcBase = new Set();
for (const f of srcFiles) {
  const bn = path.basename(f, path.extname(f));
  srcBase.add(bn);
  srcBase.add(bn.replace(/\$/g, "._"));
  srcBase.add(normShop(bn.replace(/\$/g, "._")));
}

const noise = /^(arrow-|chevron-|circle-|calendar|check$|clock$|ban$|banknote|camera$|clipboard-|flame$|key$|keyboard|lock-|message-circle|indian-rupee|createLucideIcon|bwip|JsBarcode|es2015|esm$|index\.es|factory$|dist$|lib$|database$|middleware|hardware$|react$|purify|pdf\.worker|loader-circle|image$|image-plus|info$|link$|link-2|monitor$|pen$|pencil$|phone$|power$|qr-code|recycle|share-2|trending|wifi|package$|pack$|funnel|file-down|matchContext|ClientOnly|not-found|redirect$|useRouter|useStore|useMatch|rolldown|vendor-)/;

const unmatched = [];
const business = [];
for (const b of [...shopBases.keys()].sort()) {
  const n = normShop(b);
  let found = srcBase.has(b) || srcBase.has(n);
  if (!found) {
    for (const s of srcBase) {
      if (s === n || s.startsWith(n) || n.startsWith(s)) {
        found = true;
        break;
      }
    }
  }
  // path contains basename
  if (!found) {
    const needle = n.replace(/\$id|\.$/g, "");
    found = srcFiles.some((f) => f.replace(/\\/g, "/").includes(needle.replace(/\./g, "/")) || path.basename(f).includes(needle));
  }
  if (!found) {
    unmatched.push(b);
    if (!noise.test(b) && !/^(about|blog|inventory|invoice|mobile)$/.test(b)) business.push(b);
  }
}

console.log(JSON.stringify({
  shopUnique: shopBases.size,
  srcFiles: srcFiles.length,
  unmatched: unmatched.length,
  businessUnmatched: business.length,
  business,
}, null, 2));
fs.writeFileSync("_reconstruction/full-gap-refresh.json", JSON.stringify({ shopUnique: shopBases.size, unmatched, business }, null, 2));
fs.writeFileSync("_reconstruction/unmatched-business-refresh.txt", business.join("\n") + "\n");
