import fs from 'fs';

function findInSrc(pattern) {
  const list = [];
  function walk(d) {
    fs.readdirSync(d).forEach(f => {
      const p = d + '/' + f;
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.toLowerCase().includes(pattern.toLowerCase())) list.push(p);
    });
  }
  walk('src');
  return list;
}

console.log('ItemMasterPicker:', findInSrc('ItemMasterPicker'));
console.log('LegalConsentFields:', findInSrc('LegalConsentFields'));
console.log('PortalLoginPage:', findInSrc('PortalLoginPage'));
console.log('drafts:', findInSrc('draft'));
