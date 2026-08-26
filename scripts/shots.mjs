/* Drives the running app in a real browser and saves screenshots.
   Usage: node scripts/shots.mjs [baseUrl] [outDir]  */

import fs from 'fs';
import puppeteer from 'puppeteer-core';

const BASE = process.argv[2] || 'http://localhost:4000';
const OUT = process.argv[3] || 'shots';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const shot = async (name) => {
  await new Promise((r) => setTimeout(r, 550));
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  shot', name);
};

const click = async (selector, { text } = {}) => {
  if (text) {
    const found = await page.evaluate((sel, t) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.trim().includes(t));
      if (el) { el.click(); return true; }
      return false;
    }, selector, text);
    if (!found) throw new Error(`no ${selector} containing "${text}"`);
  } else {
    await page.waitForSelector(selector, { timeout: 8000 });
    await page.click(selector);
  }
  await new Promise((r) => setTimeout(r, 450));
};

const email = `shot-${Date.now()}@example.com`;
const PASSWORD = 'correct horse battery';

console.log('capturing wallet flow');

// Pin the locale: the browser's own language would otherwise decide it and
// the label-based selectors below would miss.
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('deficoins.lang', 'en'));

// 1. unlock
await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await shot('01-unlock');

// 2. language sheet
await click('.lang-chip');
await shot('02-language');
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 350));

// 3. create wallet
await page.goto(BASE + '/create', { waitUntil: 'networkidle2' });
await page.type('#name', 'Eric Marcoux');
await page.type('#cemail', email);
await page.type('#cpw', PASSWORD);
await page.type('#cpw2', PASSWORD);
await shot('03-create');

// 4. recovery phrase
await click('button[type="submit"]');
await page.waitForSelector('.phrase-grid', { timeout: 10000 });
await shot('04-phrase');

// 5. home (empty)
await click('.btn-primary', { text: '' }).catch(() => {});
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((e) => e.className.includes('btn-quiet'));
  b?.click();
});
await page.waitForSelector('.balance-amount', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 1200));
await shot('05-home-empty');

/* Fund the account through the admin API so the populated screens have
   something real to render. */
const admin = await fetch(BASE + '/api/auth/admin-login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'dev-admin-pass' }),
}).then((r) => r.json());

const users = await fetch(BASE + '/api/admin/users', {
  headers: { authorization: 'Bearer ' + admin.token },
}).then((r) => r.json());
const uid = users.users.find((u) => u.email === email).id;

for (const [coin, delta] of [['BTC', 0.28], ['ETH', 4.2], ['USDC', 3200], ['SOL', 26]]) {
  await fetch(`${BASE}/api/admin/users/${uid}/adjust`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + admin.token },
    body: JSON.stringify({ coin, delta, note: 'Deposit settled' }),
  });
}

// 6. home (funded)
await page.reload({ waitUntil: 'networkidle2' });
await page.waitForSelector('.asset-row', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 900));
await shot('06-home-funded');

// 7. market, further down
await page.evaluate(() => window.scrollTo(0, 700));
await shot('07-market');

// 8. receive
await page.goto(BASE + '/receive?coin=BTC', { waitUntil: 'networkidle2' });
await page.waitForSelector('.qr-frame img', { timeout: 10000 });
await shot('08-receive');

// 9. coin picker
await click('.coin-select-btn');
await shot('09-coin-picker');
await page.keyboard.press('Escape');

// 10. send
await page.goto(BASE + '/send', { waitUntil: 'networkidle2' });
await page.waitForSelector('.amount-input', { timeout: 10000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.chip')].find((e) => e.textContent.includes('USDC'));
  if (!b) throw new Error('USDC chip not found');
  b.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.type('.amount-input', '200');
await page.type('.field input[spellcheck="false"]', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
await shot('10-send');

// 11. swap
await page.goto(BASE + '/swap', { waitUntil: 'networkidle2' });
await page.waitForSelector('.amount-box', { timeout: 10000 });
await shot('11-swap');

// 12. history
await page.goto(BASE + '/history', { waitUntil: 'networkidle2' });
await page.waitForSelector('.tx-row', { timeout: 10000 });
await shot('12-history');

// 13. buy sheet
await page.goto(BASE + '/wallet', { waitUntil: 'networkidle2' });
await page.waitForSelector('.actions', { timeout: 10000 });
// Buy is the fifth action; match by position so the label's language
// cannot break the capture.
await page.evaluate(() => document.querySelectorAll('.action')[4]?.click());
await page.waitForSelector('.sheet .coin-grid', { timeout: 8000 });
await new Promise((r) => setTimeout(r, 500));
await shot('13-buy');
await page.keyboard.press('Escape');

// 14. support chat
await new Promise((r) => setTimeout(r, 400));
await click('.support-fab');
await new Promise((r) => setTimeout(r, 800));
await shot('14-support');
await page.keyboard.press('Escape');

// 15. settings
await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
await page.waitForSelector('.settings-row', { timeout: 10000 });
await shot('15-settings');

// 16. French
await page.evaluate(() => localStorage.setItem('deficoins.lang', 'fr'));
await page.goto(BASE + '/wallet', { waitUntil: 'networkidle2' });
await page.waitForSelector('.actions', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 900));
await shot('16-home-fr');

// ---- admin console, desktop viewport ----
console.log('capturing admin console');
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(BASE + '/admin', { waitUntil: 'networkidle2' });
await page.waitForSelector('.admin-login', { timeout: 10000 });
await page.type('#ap', 'dev-admin-pass');
await shot('17-admin-login');

await click('button[type="submit"]');
await page.waitForSelector('.admin-table', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 800));
await shot('18-admin-users');

await click('.link-btn');
await page.waitForSelector('.drawer', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 900));
await shot('19-admin-user-detail');

await page.keyboard.press('Escape');
await page.evaluate(() => document.querySelector('.drawer-scrim')?.click());
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.admin-tab')].find((e) => e.textContent.includes('Market'));
  b?.click();
});
await page.waitForSelector('.switch', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 700));
await shot('20-admin-market');

await browser.close();

console.log('\nJS errors:', errors.length);
for (const e of errors.slice(0, 12)) console.log('  ' + e);
