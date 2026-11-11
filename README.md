# ineedit

A self-hosted wishlist that watches prices.

Paste a product link from almost any shop. ineedit reads the page, stores the
current price, and keeps checking it on your schedule. When something hits your
target price or a new all-time low, you get a badge in the app and an optional
push notification.

Built to run on a Raspberry Pi 5 next to the services you already have: one
Next.js process, one worker process, and a single SQLite file.

## What it does

- Add items from any product URL: title, image, price, currency, availability.
- Record a price history and draw a trend chart.
- Set a target price and see how far away it is.
- Flag deals: target hit or lowest price ever recorded.
- Check prices on a per-item interval (1 hour to 1 week).
- Record prices manually when a shop blocks bots.
- Optional push notifications through [ntfy](https://ntfy.sh).
- Optional single-user username/password login.
- Everything is local: SQLite, no third-party account, no cloud.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- SQLite through `better-sqlite3`, Drizzle ORM + migrations
- `cheerio` scraper with JSON-LD / meta / microdata / CSS selector support
- `node-cron` worker
- Recharts for the price chart

## Quick start

1. Copy the environment file and generate a session secret:

   ```bash
   cp .env.example .env
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Put the generated string in `AUTH_SECRET`, then set `APP_USERNAME` and
   `APP_PASSWORD`.

2. Install dependencies:

   ```bash
   npm install
   ```

   On npm 11+, native install scripts may need approval once:
   `npm install-scripts approve better-sqlite3 esbuild`

3. Start the web app:

   ```bash
   npm run dev
   ```

4. In a second terminal, start the price worker:

   ```bash
   npm run worker
   ```

5. Open <http://localhost:3000>.

Migrations run automatically on first start. The database is created at
`data/ineedit.db` (or wherever `DATABASE_PATH` points).

### Add an item

1. Paste a product URL and wait for the preview.
2. Optionally set a target price, category, notes, and check interval.
3. Add it. The first price is stored immediately.
4. Press the refresh icon on a card, or wait for the worker, to add more points.

The add page also accepts a URL in the query string, so you can make a
bookmarklet:

```js
javascript:(()=>{location.href='http://YOUR-PI:3000/items/new?url='+encodeURIComponent(location.href)})()
```

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_PATH` | `./data/ineedit.db` | SQLite file path. Docker uses `/data/ineedit.db`. |
| `APP_USERNAME` | empty | Optional username for the login screen. |
| `APP_PASSWORD` | empty | Enables the login screen. Leave empty only on a trusted private network. |
| `AUTH_SECRET` | empty | Signs the session cookie. Changing it logs everyone out. |
| `COOKIE_SECURE` | `false` | Set `true` when the app is served over HTTPS. |
| `DEFAULT_CURRENCY` | `EUR` | Used when a shop does not expose a currency. |
| `SCRAPER_USER_AGENT` | Chrome UA | User agent used for page requests. |
| `SCRAPER_TIMEOUT_MS` | `15000` | Page fetch timeout. |
| `CHECK_CRON` | `*/15 * * * *` | How often the worker looks for due items. This is not the per-item interval. |
| `CHECK_ON_START` | `true` | Run a due-item pass when the worker starts. |
| `TZ` | system | IANA timezone for the worker, e.g. `Europe/Lisbon`. |
| `NTFY_URL` | `https://ntfy.sh` | ntfy server base URL. |
| `NTFY_TOPIC` | empty | Enables notifications when set. |
| `NTFY_TOKEN` | empty | Optional bearer token for a protected ntfy server. |

## Checking prices / cron

`npm run worker` is a long-running process. Every `CHECK_CRON` tick it finds
items whose own interval is due and checks them with concurrency 2 and a small
random delay. Each item stores its own interval, so a 24-hour item is checked
once a day even if the scheduler ticks every 15 minutes.

**Choose one scheduler, not both:**

### Option A: worker process (recommended)

```bash
npm run worker
```

Docker Compose already runs this as the `worker` service. On bare metal use
`deploy/ineedit-worker.service`.

### Option B: system cron

Run a one-shot check from cron instead of keeping the worker alive:

```cron
*/15 * * * * pi cd /home/martin/ineedit && /usr/bin/npm run check >> /home/martin/ineedit/check.log 2>&1
```

A copy is in `deploy/ineedit-check.cron`. If you use this, do **not** run the
worker service, or every due item will be checked twice.

One-off commands:

```bash
npm run check           # check only items that are due
npm run check -- --all  # force a check of every watching item
```

The CLI loads `.env` and `.env.local` automatically.

## Raspberry Pi 5 with Docker

Prerequisites: 64-bit Raspberry Pi OS and Docker with Compose.

1. Copy the project to the Pi (clone or `scp`) and enter the folder.

2. Create the environment file:

   ```bash
   cp .env.example .env
   nano .env
   ```

   Set at least `APP_USERNAME`, `APP_PASSWORD`, `AUTH_SECRET`, `TZ`, and
   `DEFAULT_CURRENCY`.
   Set `COOKIE_SECURE=true` once HTTPS is in front of the app.

3. Build and start:

   ```bash
   docker compose up -d --build
   docker compose ps
   ```

4. Check health:

   ```bash
   curl http://localhost:3000/api/health
   ```

5. Follow logs:

   ```bash
   docker compose logs -f web
   docker compose logs -f worker
   ```

6. Put it behind Caddy, nginx, or Tailscale. An example Caddy block is in
   `deploy/Caddyfile.example`. Then set `COOKIE_SECURE=true` and restart.

The database lives in the `ineedit_data` Docker volume and survives rebuilds.
To update:

```bash
git pull
docker compose up -d --build
```

> Do not expose port 3000 directly to the internet. Use HTTPS in front.

### Bare metal (systemd)

```bash
npm ci
npm run build
sudo cp deploy/ineedit-web.service /etc/systemd/system/
sudo cp deploy/ineedit-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ineedit-web ineedit-worker
```

Adjust `User`, `WorkingDirectory`, and the `npm` path in the unit files if your
user or install location differs. If `better-sqlite3` has no prebuilt binary for
your Node/architecture, install `build-essential` and `python3` first.

## Backups

The whole app is one SQLite database. A consistent backup while running:

```bash
docker compose exec web node -e "const D=require('better-sqlite3'); new D('/data/ineedit.db').backup('/data/backup.db').then(()=>console.log('done'))"
docker compose cp web:/data/backup.db ./ineedit-backup.db
docker compose exec web rm /data/backup.db
```

Bare metal:

```bash
sqlite3 data/ineedit.db ".backup 'ineedit-backup.db'"
```

Keep a copy off the Pi. The database includes the full price history.

## How price detection works

For each page, in order:

1. **Custom selectors** from the item settings.
2. **JSON-LD** `Product` / `Offer` structured data (most shops).
3. **Open Graph / product meta tags** (`product:price:amount`, etc.).
4. **Microdata** (`itemprop="price"`).
5. **Common price elements** (`.price`, `[data-price]`, `[class*="price"]`).

Title comes from the product data, Open Graph, `<h1>`, or `<title>`. Images are
resolved against the final URL and enlarged when the shop uses a thumbnail
width parameter.

If a shop renders prices only with JavaScript, or blocks non-browser requests,
automatic checks will fail. Options:

- Set a custom CSS price selector in the item settings (right-click the price
  in the browser → Inspect → Copy selector). This works when the price is
  present in the HTML.
- Use **Add a price manually** on the item page.
- Look at the error banner on the item; it explains whether the shop blocked
  the request, timed out, or had no readable price.

The scraper does not solve CAPTCHAs, does not execute JavaScript, and does not
evade anti-bot systems. Respect shop terms and keep intervals reasonable; the
default is every 6 hours with a delay between requests.

Prices are stored as integer cents plus an ISO currency code. If a shop exposes
no currency, `DEFAULT_CURRENCY` is used. The dashboard value is grouped by
currency.

## Deals, history, and notifications

- A point is stored when the price changes or when the last stored point is
  more than one hour old.
- **Target hit** means the current price is at or below the target.
- **Lowest ever** requires at least two recorded points.
- A **deal badge** is a target hit, or a new all-time low with at least three
  points.
- ntfy sends on a target crossing, and on a new low that is at least 3% below
  the last notified low.
- Check history is kept forever. At 4 checks/day, a single item produces roughly
  1,500 rows per year, which SQLite handles comfortably.

## Project layout

```text
src/app/                 pages and API routes
src/app/(app)/           authenticated shell, dashboard, add/detail pages
src/app/(auth)/login/    login screen
src/components/          UI components
src/lib/db/              Drizzle schema and SQLite connection
src/lib/scrape.ts        page fetcher and price extractor
src/lib/parse-price.ts   price/currency parsing
src/lib/queries.ts       dashboard and detail queries
src/lib/stats.ts         price/delta/deal calculations
src/worker/              scheduler, batch runner, single check
drizzle/                 generated SQL migrations
deploy/                  systemd, cron, Caddy examples
compose.yaml             RPi Docker deployment
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run worker` | Long-running price scheduler |
| `npm run check` | One-shot due-item check |
| `npm run check -- --all` | Force-check every watching item |
| `npm run db:generate` | Generate a migration after schema changes |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run typecheck` | TypeScript check |

## Security notes

- Set `APP_USERNAME` and `APP_PASSWORD` before exposing the app beyond your machine. The login
  cookie is signed with `AUTH_SECRET` and is HTTP-only.
- Use HTTPS and `COOKIE_SECURE=true` when the app leaves the LAN.
- The scraper refuses localhost/private-network URLs and follows redirects with
  the same check, but this is a personal tool, not a hardened multi-tenant
  service.
- Logins are rate-limited only by a short delay. Put a reverse proxy in front
  if the app is internet-facing.

## Possible next steps

- Site-specific adapters for shops with awkward markup.
- Optional headless-browser fallback for JavaScript-only shops.
- CSV export/import.
- Price-history retention settings.
- Multiple users or shared lists.
