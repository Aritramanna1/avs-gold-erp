import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

const routesDir = path.resolve('src/routes');
const files = getFiles(routesDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

console.log('Total route files:', files.length);

const routePaths = files.map(f => {
  const rel = path.relative(routesDir, f);
  let p = rel.replace(/\\/g, '/').replace(/\.tsx?$/, '');
  if (p === '__root') return null;
  p = p.replace(/\.index$/, '').replace(/\/index$/, '');
  p = '/' + p.replace(/\./g, '/').replace(/\$/g, ':');
  return p === '' ? '/' : p;
}).filter(Boolean);

console.log('Processed unique route paths:', routePaths.length);
fs.writeFileSync('scripts/routes-list.json', JSON.stringify(routePaths, null, 2));
console.log('Saved to scripts/routes-list.json');
