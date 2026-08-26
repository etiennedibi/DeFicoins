/* Reports key drift between en.js and every other locale. */
import fs from 'fs';
import path from 'path';

const dir = 'app/src/i18n/locales';
const keysOf = (file) => {
  const src = fs.readFileSync(path.join(dir, file), 'utf8');
  return (src.match(/^\s+'[^']+':/gm) || []).map((s) => s.trim().slice(1, -2));
};

const en = keysOf('en.js');
const enSet = new Set(en);
let bad = 0;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.js') && f !== 'en.js')) {
  const k = keysOf(file);
  const set = new Set(k);
  const missing = en.filter((x) => !set.has(x));
  const extra = k.filter((x) => !enSet.has(x));
  const ok = !missing.length && !extra.length;
  if (!ok) bad++;
  console.log(
    `${ok ? 'OK  ' : 'DIFF'} ${file.padEnd(7)} ${String(k.length).padStart(3)}/${en.length}` +
      (missing.length ? `  missing(${missing.length}): ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}` : '') +
      (extra.length ? `  extra(${extra.length}): ${extra.join(', ')}` : '')
  );
}
console.log(bad ? `\n${bad} locale(s) out of sync with en.js` : '\nAll locales in sync.');
