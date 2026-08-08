const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const srcDir = path.join(root, "src");
const allowedLayoutSidebarImporters = new Set([
  path.normalize("src/components/app-shell.tsx"),
  path.normalize("src/components/GlobalCommandPalette.tsx"),
]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const failures = [];

for (const file of walk(srcDir)) {
  const rel = path.relative(root, file);
  const normalized = path.normalize(rel);
  const content = fs.readFileSync(file, "utf8");

  if (content.includes("@/components/ui/sidebar") || content.includes("../components/ui/sidebar")) {
    failures.push(`${rel}: must not import deprecated ui/sidebar`);
  }

  const importsLayoutSidebar =
    content.includes("@/components/layout/Sidebar") ||
    content.includes("../components/layout/Sidebar") ||
    content.includes("./layout/Sidebar");

  if (importsLayoutSidebar && !allowedLayoutSidebarImporters.has(normalized)) {
    failures.push(`${rel}: imports layout Sidebar outside the approved shell/palette entry points`);
  }
}

if (failures.length) {
  console.error("[protect-sidebar-from-imports] failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[protect-sidebar-from-imports] OK");
