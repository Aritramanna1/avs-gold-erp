import fs from "fs";

const content = fs.readFileSync("src/routeTree.gen.ts", "utf8");
const fullPaths = [];
const pathMatches = content.matchAll(/fullPath:\s*['"]([^'"]+)['"]/g);
for (const match of pathMatches) {
  fullPaths.push(match[1]);
}

const uniquePaths = Array.from(new Set(fullPaths)).sort();
console.log("Total unique full paths:", uniquePaths.length);
console.log(JSON.stringify(uniquePaths, null, 2));
