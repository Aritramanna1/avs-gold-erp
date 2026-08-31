import fs from "fs";
import path from "path";
const dir = "production-dist-shop/assets";
const needles = ["/mtg","catalog.masters","/dice","wipeout","/workflows","/scheme","/assistant","/crm","CEO (View Only)","people-query","fetchPeoplePage","get_home_dashboard","pullPeople","STARTUP_LEDGER_CACHE_LIMIT"];
const hits = {};
for (const n of needles) hits[n] = { count: 0, files: [] };
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith(".js")) continue;
  const t = fs.readFileSync(path.join(dir, f), "utf8");
  for (const n of needles) {
    if (!t.includes(n)) continue;
    const c = t.split(n).length - 1;
    hits[n].count += c;
    if (hits[n].files.length < 3) hits[n].files.push(f);
  }
}
console.log(JSON.stringify(hits, null, 2));
