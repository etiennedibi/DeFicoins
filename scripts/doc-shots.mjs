/* Captures the screenshots used by the user and admin guides, in French,
   from real seeded data. Writes PNGs to docs/shots/.

   Usage: node scripts/doc-shots.mjs [baseUrl] */

import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { db, toObjects } from '../server/lib/db.js';

const BASE = process.argv[2] || 'http://localhost:4000';
const OUT = 'docs/shots';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SAMPLE_EMAIL = 'awa.exemple@demo.app';

fs.mkdirSync(OUT, { recursive: true });

/* The sign-up capture registers a sample account. Clear it first so the script
   is re-runnable — a second run would otherwise hit "email already exists" and
   never reach the recovery-phrase screen. */
for (const u of toObjects(await db.execute({
  sql: 'SELECT id FROM users WHERE email = ?', args: [SAMPLE_EMAIL],
}))) {
  for (const t of ['wallets', 'transactions', 'buy_orders', 'messages', 'password_resets']) {
    await db.execute({ sql: `DELETE FROM ${t} WHERE user_id = ?`, args: [u.id] });
  }
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [u.id] });
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await wait(600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  ' + name);
};

const phone = () => page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const desk = (h = 1000) => page.setViewport({ width: 1440, height: h, deviceScaleFactor: 1 });

async function signIn(email, password = 'demo1234') {
  await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
  await page.type('#email', email);
  await page.type('#pw', password);
  await page.click('button[type="submit"]');
  await page.waitForSelector('.balance-amount', { timeout: 25000 });
  await wait(1400);
}

// ---------------------------------------------------------------- wallet
console.log('wallet (fr)');
await phone();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => localStorage.setItem('deficoins.lang', 'fr'));

await page.goto(BASE + '/', { waitUntil: 'networkidle2' });
await shot('u-01-connexion');

await page.click('.lang-chip');
await wait(500);
await shot('u-02-langues');
await page.keyboard.press('Escape');
await wait(400);

await page.goto(BASE + '/create', { waitUntil: 'networkidle2' });
await page.type('#name', 'Awa Traoré');
await page.type('#cemail', SAMPLE_EMAIL);
await page.type('#cpw', 'motdepasse-solide');
await page.type('#cpw2', 'motdepasse-solide');
await shot('u-03-creation');

await page.click('button[type="submit"]');
await page.waitForSelector('.phrase-grid', { timeout: 25000 });
await shot('u-04-phrase');

// leave that throwaway account and use the seeded one instead
await page.evaluate(() => localStorage.removeItem('deficoins.token'));

await signIn('eric@demo.app');
await shot('u-05-accueil');

await page.evaluate(() => window.scrollTo(0, 760));
await shot('u-06-marche');
await page.evaluate(() => window.scrollTo(0, 0));

await page.goto(BASE + '/receive?coin=BTC', { waitUntil: 'networkidle2' });
await page.waitForSelector('.qr-frame img', { timeout: 25000 });
await shot('u-07-recevoir');

await page.click('.coin-select-btn');
await wait(600);
await shot('u-08-choix-devise');
await page.keyboard.press('Escape');

await page.goto(BASE + '/send', { waitUntil: 'networkidle2' });
await page.waitForSelector('.amount-input', { timeout: 25000 });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.chip')].find((e) => e.textContent.includes('USDC'));
  if (!b) throw new Error('no USDC chip');
  b.click();
});
await wait(400);
await page.type('.amount-input', '250');
await page.type('.field input[spellcheck="false"]', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
await shot('u-09-envoyer-valide');

// the invalid-address state, which the guide needs to show
await page.evaluate(() => {
  const i = document.querySelector('.field input[spellcheck="false"]');
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  set.call(i, '0x12345');
  i.dispatchEvent(new Event('input', { bubbles: true }));
});
await shot('u-10-envoyer-invalide');

await page.goto(BASE + '/swap', { waitUntil: 'networkidle2' });
await page.waitForSelector('.amount-box', { timeout: 25000 });
await page.evaluate(() => document.querySelectorAll('.amount-box .chip')[0]?.click());
await page.waitForSelector('.sheet .coin-row', { timeout: 15000 });
await page.evaluate(() => {
  const r = [...document.querySelectorAll('.coin-row')].find((e) => e.textContent.includes('BTC'));
  r?.click();
});
await wait(700);
await page.evaluate(() => document.querySelectorAll('.amount-box .chip')[1]?.click());
await page.waitForSelector('.sheet .coin-row', { timeout: 15000 });
await page.evaluate(() => {
  const r = [...document.querySelectorAll('.coin-row')].find((e) => e.textContent.includes('USDT'));
  r?.click();
});
await wait(700);
await page.type('.amount-box .amount-input', '0.05');
await wait(600);
await shot('u-11-echanger');

await page.goto(BASE + '/history', { waitUntil: 'networkidle2' });
await page.waitForSelector('.tx-row', { timeout: 25000 });
await shot('u-12-historique');

await page.click('.tx-row');
await wait(700);
await shot('u-13-historique-detail');
await page.keyboard.press('Escape');

await page.goto(BASE + '/wallet', { waitUntil: 'networkidle2' });
await page.waitForSelector('.actions', { timeout: 25000 });
await page.evaluate(() => document.querySelectorAll('.action')[4]?.click());
await page.waitForSelector('.sheet .coin-grid', { timeout: 15000 });
await page.type('.sheet .amount-input', '500');
await wait(500);
await shot('u-14-acheter');
await page.keyboard.press('Escape');
await wait(500);

await page.click('.support-fab');
await page.waitForSelector('.chat-log', { timeout: 15000 });
await wait(1000);
await shot('u-15-support');
await page.keyboard.press('Escape');

await page.goto(BASE + '/settings', { waitUntil: 'networkidle2' });
await page.waitForSelector('.settings-row', { timeout: 25000 });
await shot('u-16-parametres');

/* /recover is a signed-out route: while a session is live it redirects to the
   wallet, so drop the token before navigating there. */
await page.evaluate(() => localStorage.removeItem('deficoins.token'));
await page.goto(BASE + '/recover', { waitUntil: 'networkidle2' });
await page.waitForSelector('#remail', { timeout: 15000 });
await page.type('#remail', 'eric@demo.app');
await wait(400);
await shot('u-17-mot-de-passe-oublie');

// masked balance, for the privacy section
await signIn('eric@demo.app');
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.balance-row button')];
  b[b.length - 1]?.click();
});
await wait(700);
await shot('u-18-solde-masque');

// ---------------------------------------------------------------- admin
console.log('admin (en)');
await desk();
await page.goto(BASE + '/admin', { waitUntil: 'networkidle2' });
await page.waitForSelector('.admin-login', { timeout: 25000 });
await page.type('#ap', 'dev-admin-pass');
await shot('a-01-connexion');

await page.click('button[type="submit"]');
await page.waitForSelector('.admin-table', { timeout: 25000 });
await wait(1200);
await shot('a-02-utilisateurs');

await desk(1200);
await page.evaluate(() => [...document.querySelectorAll('.admin-tab')].find((e) => e.textContent.includes('Queue'))?.click());
await page.waitForSelector('.reset-cell', { timeout: 25000 });
await wait(1200);
await shot('a-03-file-attente');

await page.evaluate(() => [...document.querySelectorAll('.admin-tab')].find((e) => e.textContent.includes('Market'))?.click());
await page.waitForSelector('.switch', { timeout: 25000 });
await wait(1000);
await shot('a-04-marche');

await desk(1000);
await page.evaluate(() => [...document.querySelectorAll('.admin-tab')].find((e) => e.textContent.includes('Users'))?.click());
await page.waitForSelector('.admin-table', { timeout: 25000 });
await wait(700);
await page.evaluate(() => {
  const row = [...document.querySelectorAll('.admin-table tbody tr')].find((r) => r.textContent.includes('Eric'));
  row?.querySelector('.link-btn')?.click();
});
await page.waitForSelector('.drawer', { timeout: 25000 });
await wait(1300);
await shot('a-05-fiche-soldes');

for (const [tab, name] of [['Activity', 'a-06-fiche-activite'], ['Chat', 'a-07-fiche-chat'], ['Account', 'a-08-fiche-compte']]) {
  await page.evaluate((t) => {
    [...document.querySelectorAll('.drawer-tabs button')].find((e) => e.textContent.trim() === t)?.click();
  }, tab);
  await wait(1100);
  await shot(name);
}

await browser.close();
console.log('\nJS errors:', errors.length);
errors.slice(0, 8).forEach((e) => console.log('  ' + e));
