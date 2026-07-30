import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const roots = ["src", "dist"].map((name) => path.join(root, name));
const forbidden = [
  /service[_ -]?role/i,
  /supabase_service_role_key/i,
  /secret[_ -]?data\s*:\s*JSON\.stringify/i,
];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".html"]);
const findings = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (extensions.has(path.extname(entry.name))) {
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        if (pattern.test(text)) findings.push(`${path.relative(root, file)} matches ${pattern}`);
      }
    }
  }
}

for (const directory of roots) walk(directory);
if (findings.length) {
  console.error("Client security scan failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Client security scan passed: no privileged-key patterns found in src/dist.");
