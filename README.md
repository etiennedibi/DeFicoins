# DeFicoins

A multi-asset crypto wallet app with an admin console, built to the brief in
`APPLICATION CRYPTO` and modelled on `prismequitywallet.com`.

## What this is — read this first

DeFicoins runs a **custodial ledger with no blockchain connection**. Balances
are rows in a database. The admin credits and debits them; Send queues a
transfer for a human to approve; Swap is an internal book entry; Buy opens a
support conversation. The deposit addresses shown on the Receive screen and the
12-word recovery phrase shown at sign-up are **display artefacts** — no key is
derived from the phrase and no address is watched on any chain.

This is the model the reference app uses, and it is the model that was chosen
for this build. It suits a demo, an investor MVP, a training tool, or a desk
where settlement genuinely happens off-chain and the customer knows it. It is
not suitable for any product where the user is led to believe they hold crypto
that the operator has not actually got. Anything on-chain — real deposit
detection, real withdrawals — is a different architecture (custody provider,
key management, and in most jurisdictions a VASP/PSAN licence).

## Stack

| Layer | Choice |
|---|---|
| Client | React 18 + Vite 6, one SPA, code-split per route |
| API | Express 5 |
| Data | libSQL — Turso when configured, a local file otherwise |
| Prices | CoinGecko public API, cached server-side for 45 s |
| Auth | bcrypt hashes + HMAC-signed stateless session tokens |
| i18n | 8 languages, one lazy-loaded chunk each |

## Running it

```bash
npm install
cp .env.example .env      # then set ADMIN_PASS and SESSION_SECRET
npm run build             # build the SPA into dist/
npm start                 # API + app on http://localhost:4000
```

For development with hot reload, run two processes:

```bash
npm run dev:api           # API on :4000
npm run dev               # Vite on :5173, proxying /api to :4000
```

The wallet is at `/`, the admin console at `/admin`.

`.env` must set `SESSION_SECRET` in production — the server refuses to start
without one when `NODE_ENV=production`, because every session token is signed
with it.

## Layout

```
brand/                 logo source (SVG) and generated PNG icons
app/
  index.html
  public/              manifest, app icons
  src/
    routes/            one file per screen; routes/admin/ is the console
    components/        Icon set, sheets, coin picker, support widget
    i18n/locales/      en es fr de pt zh ja ko — 118 keys each
    lib/               api client, formatters, active locale
    store/wallet.jsx   session + portfolio, the single source of truth
    styles/            theme.css (tokens) + base.css + app.css
server/
  index.js             the whole API
  lib/coins.js         asset catalogue + per-chain address patterns
  lib/market.js        price feed with cache and admin overrides
  lib/auth.js          hashing, tokens, phrase and address generation
  lib/db.js            schema and migrations
scripts/
  e2e.mjs              57 checks over the live API
  test-reset.mjs       23 checks over the password-reset flow
  seed-demo.mjs        deterministic demo data
  shots.mjs            drives a real browser, writes shots/
  check-i18n.mjs       locale key parity
  test-auth.mjs        token, hashing and address-shape checks
  fetch-wordlist.mjs   re-vendors the BIP-39 list
```

## Checks

```bash
node scripts/e2e.mjs         # 57 checks, needs the server running
node scripts/test-reset.mjs  # 23 checks over the password-reset flow
node scripts/check-i18n.mjs
node scripts/test-auth.mjs
node scripts/seed-demo.mjs   # wipes and rebuilds the demo accounts
node scripts/shots.mjs       # needs Chrome at the path in the script
```

`seed-demo.mjs` gives you four accounts (password `demo1234`) with funded
portfolios, pending transfers, buy orders, open support threads, two password
reset requests and one suspended account, so every screen and every admin queue
has something in it. It clears what it created first, so re-running it always
lands on the same state.

`e2e.mjs` covers the money paths: that a send debits immediately so the same
balance cannot be queued twice, that rejecting a send refunds it, that settling
twice is refused, that a suspended account cannot sign in, and that a user
token cannot reach an admin route.

## Adding a coin

Add an entry to `COINS` in `server/lib/coins.js` with its CoinGecko id and, if
the chain is new, an address pattern in `ADDRESS_PATTERNS`. Wallet rows,
deposit addresses, pickers, the market list and the admin controls all follow
from that one entry.

## Adding a language

Copy `app/src/i18n/locales/en.js`, translate the values, and add a row to
`LANGS` in `app/src/i18n/index.jsx`. Run `node scripts/check-i18n.mjs` to
confirm no keys drifted.

## Password resets

There is no reset email. A user who has forgotten their password submits the
Recover form; that raises a request in the admin queue and posts a line in
their support thread. An admin opens **Queue → Password reset requests**, types
a new password and presses *Set and notify* — the password changes, the request
closes, and the user is told in the same support thread. *Dismiss* closes a
request without touching the password.

Two safeguards on the public endpoint: it answers identically whether or not
the address has an account, so it cannot be used to discover who is registered;
and it will not raise a second request for the same account within 15 minutes,
so it cannot be replayed to flood the queue.

## Known gaps

- **NFTs tab is an empty state**, as in the reference.
- **The display-currency selector on the home screen is not wired** — the chip
  renders but only USD is implemented.
- **No rate limiting** on the auth endpoints.
- **Chat attachments** are in the schema but not in the UI.
