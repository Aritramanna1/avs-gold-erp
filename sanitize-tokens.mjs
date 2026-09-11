import fs from 'fs';
import path from 'path';

const dir = path.resolve('scripts');
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.mjs') || f.endsWith('.js')) {
    const p = path.join(dir, f);
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes('sbp_')) {
      content = content.replace(/sbp_[a-zA-Z0-9]{30,60}/g, 'SUPABASE_ACCESS_TOKEN_REDACTED');
      fs.writeFileSync(p, content);
      console.log('Sanitized:', f);
    }
  }
}
