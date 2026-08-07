# SiteSignal

Industrial asset monitoring dashboard template. React + Vite + Express + Postgres (Drizzle) + Tailwind + shadcn/ui, with a react-three-fiber floor plan and server-side Open-Meteo ambient conditions.

The point of the template is that it is **never empty**: a clone runs migrations, seeds three sites, eighteen assets, sixty days of hourly telemetry and twelve alerts, and lands on a full dashboard.

## Quick start

```bash
npm install
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:5174>

No database to provision and no API key to obtain. First boot applies the migrations and seeds the dataset (~15–40 s depending on the machine); every later boot skips seeding.

## Database: embedded by default, Postgres when you want it

Without `DATABASE_URL` the app runs on [PGlite](https://pglite.dev) — real Postgres compiled to WASM, persisted under `./data/sitesignal`. Point `DATABASE_URL` at a server and the *same* schema, the *same* generated migrations and the *same* queries run through `node-postgres` instead:

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/sitesignal npm run dev
```

The switch lives in `server/db/client.ts` and nothing above it changes.

### Data model

| Table      | Columns |
| ---------- | ------- |
| `sites`    | `id`, `name`, `lat`, `lng`, `timezone` |
| `assets`   | `id`, `site_id`, `name`, `type`, `status` (`ok\|warning\|critical`), `pos_x`, `pos_y`, `pos_z`, `installed_at` |
| `readings` | `id`, `asset_id`, `metric`, `value`, `unit`, `recorded_at` |
| `alerts`   | `id`, `asset_id`, `severity`, `message`, `state` (`open\|ack\|resolved`), `opened_at` |

`readings` carries a composite index on `(asset_id, metric, recorded_at)` — every time-series query rides it.

### Seed

Deterministic: a fixed-seed PRNG means the dataset is identical on every machine. Each series is a daily cycle plus a weekly drift plus Gaussian sensor noise, and assets that are not healthy carry a degradation ramp over the final two weeks — so the charts show structure a human recognises rather than random walk.

```bash
npm run db:seed     # seed if empty
npm run db:reset    # truncate and rebuild
npm run db:generate # regenerate SQL migrations after a schema change
```

## Screens

| Route | What it does |
| ----- | ------------ |
| `/` | KPI cards, site selector, ambient conditions per site, sortable asset table, recent alert feed |
| `/assets/:id` | react-three-fiber floor plan of the whole site — assets as extruded boxes at their stored coordinates, tinted by status, with pulsing clickable hotspots that raise a sensor readout — plus latest readings, per-metric telemetry charts and alert history |
| `/analytics` | Multi-asset comparison on one metric, range selector from 24 h to 60 d, series summary table |
| `/design-system` | Living documentation: colour tokens, type scale, spacing, shape, motion, and every UI component the app ships, rendered by the real components |

`?site=<id>` on `/` keeps the scope in the URL.

## API

All read-only, under `/api`.

| Endpoint | Notes |
| -------- | ----- |
| `GET /health` | Status and active driver |
| `GET /overview?siteId=` | KPIs + assets + recent alerts + ambient, one round trip |
| `GET /sites`, `GET /sites/:id` | |
| `GET /sites/ambient`, `GET /sites/:id/ambient` | Open-Meteo, cached 15 min |
| `GET /assets?siteId=` | Rows with latest value per metric and 24 h delta |
| `GET /assets/:id?range=` | Detail: asset, site, siblings, alerts, series |
| `GET /assets/:id/readings?metric=&range=` | |
| `GET /alerts?siteId=&assetId=&state=&limit=` | |
| `GET /analytics/series?assetIds=1,4,9&metric=&range=` | Up to six assets |

Query parameters are validated with Zod; a bad value returns `400` with the offending field, an unknown id returns `404`.

### Open-Meteo

No API key. `server/services/weather.ts` fetches current conditions and a forecast per site by lat/lng, caches for `WEATHER_CACHE_MINUTES` (15), collapses concurrent misses into one upstream call, and on failure serves the expired entry flagged `stale` rather than breaking the page.

## Design system

`src/styles/tokens.css` is the single theme file — every colour, size, radius, shadow and duration in the product. Three layers: primitives (raw ramp), semantic (`--sig-surface-raised`, `--sig-status-critical`), component (`--sig-panel-*`, scene colours).

Components never hardcode a colour. `src/styles/index.css` maps the tokens into Tailwind's theme with `@theme inline`, so `bg-raised` emits `var(--sig-surface-raised)` rather than a literal. Consumers that cannot use CSS — three.js materials, Recharts strokes — read the computed value through `readToken()` in `src/theme/tokens.ts`, so there is still exactly one definition of each value.

Tailwind v4 has no `--duration-*` theme namespace, so timing is expressed through the `motion-fast` / `motion-base` / `motion-slow` utilities rather than raw `duration-150` classes. All of them collapse to `0ms` under `prefers-reduced-motion`, including the 3D auto-orbit and the hotspot pulse.

## Scripts

| Script | |
| ------ | - |
| `npm run dev` | API and Vite together |
| `npm run build` | Typecheck then build the client to `dist/` |
| `npm start` | Express only; serves `dist/` when it exists |
| `npm run preview` | Build then serve on one port |
| `npm run typecheck` | `tsc -b` across client, server and tooling |

## Layout

```
shared/types.ts        contract shared by API and client
server/
  db/                  schema · client · migrate · seed · queries
  routes/              overview · sites · assets · alerts · analytics
  services/weather.ts  Open-Meteo client with cache
src/
  styles/tokens.css    THE theme file
  theme/tokens.ts      runtime token access + design-system catalogue
  components/ui/       shadcn/ui primitives on Radix
  components/          domain components
  routes/              the four screens
drizzle/               generated SQL migrations
```

## Deliberately out of scope

No authentication, no roles, no tests, no extra features — this is a template for the monitoring surface itself.
