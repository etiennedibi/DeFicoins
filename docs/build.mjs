/* Builds the publishable guides: inlines the shared stylesheet and embeds every
   screenshot as a data URI, so each page is a single self-contained file.

   Usage: node docs/build.mjs */

import fs from 'fs';
import path from 'path';

const DIR = 'docs';
const SHOTS = path.join(DIR, 'web');

const css = fs.readFileSync(path.join(DIR, '_style.css'), 'utf8');

const cache = new Map();
function dataUri(name) {
  if (cache.has(name)) return cache.get(name);
  const file = path.join(SHOTS, name + '.jpg');
  if (!fs.existsSync(file)) throw new Error('missing screenshot: ' + file);
  const uri = 'data:image/jpeg;base64,' + fs.readFileSync(file).toString('base64');
  cache.set(name, uri);
  return uri;
}

let built = 0;
for (const src of fs.readdirSync(DIR).filter((f) => f.endsWith('.src.html'))) {
  const out = src.replace('.src.html', '.html');
  let html = fs.readFileSync(path.join(DIR, src), 'utf8');

  html = html.replace('/* STYLE */', () => css);

  const used = new Set();
  html = html.replace(/src="shots\/([a-z0-9-]+)\.jpg"/g, (_, name) => {
    used.add(name);
    return 'src="' + dataUri(name) + '"';
  });

  fs.writeFileSync(path.join(DIR, out), html);
  const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
  console.log(`${out.padEnd(28)} ${String(used.size).padStart(2)} images   ${kb} KB`);
  built++;
}

if (!built) console.log('no .src.html files found in ' + DIR);
