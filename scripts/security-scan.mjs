import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const clientRoots = ["src", "dist"].map((name) => path.join(root, name));
const scriptRoots = [path.join(root, "scripts")];
const clientForbidden = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /service_role_key\s*[:=]/i,
  /secret[_ -]?data\s*:\s*JSON\.stringify/i,
  /Authorization:\s*`Bearer\s+[A-Za-z0-9_-]{20,}/,
  /headers:\s*\{[^}]*Bearer\s+[A-Za-z0-9_-]{20,}/,
  /sb_secret_[A-Za-z0-9]+/,
  /sk_live_[A-Za-z0-9]+/,
  /sk_test_[A-Za-z0-9]+/,
  /whsec_[A-Za-z0-9]+/,
  /HOSTINGER_API_TOKEN\s*=\s*["'][^"']+["']/i,
];
const scriptForbidden = [
  /HOSTINGER_API_TOKEN\s*=\s*["'][^"']+["']/i,
  /sk_live_[A-Za-z0-9]+/,
  /sb_secret_[A-Za-z0-9]+/,
];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html"]);
const ignoreFiles = new Set([
  path.join(root, "scripts", "security-scan.mjs"),
  path.join(root, "scripts", "provision-testing-accounts.mjs"),
]);
const findings = [];

function walk(directory, patterns, { ignoreSelf = false } = {}) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file, patterns, { ignoreSelf });
    else if (extensions.has(path.extname(entry.name))) {
      if (ignoreSelf && ignoreFiles.has(file)) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of patterns) {
        if (pattern.test(text)) findings.push(`${path.relative(root, file)} matches ${pattern}`);
      }
    }
  }
}

for (const directory of clientRoots) walk(directory, clientForbidden);
for (const directory of scriptRoots) walk(directory, scriptForbidden, { ignoreSelf: true });

if (findings.length) {
  console.error("Client security scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Client security scan passed: no privileged-key patterns found in src/dist/scripts.");
