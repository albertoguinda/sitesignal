# SiteSignal

**A monitoring dashboard that is already full of data the moment you open it.**

Three industrial sites, eighteen machines, sixty days of telemetry, live weather
per site, a 3D floor plan you can click through, and a documented design system.
No database to provision, no API key to sign up for, no empty state to stare at.

<!-- SCREENSHOT: overview screen, 1512×950, docs/media/overview.png -->
<!-- GIF: click a hotspot in the 3D floor plan → sensor readout panel opens, docs/media/hotspot.gif -->

---

## Run it

**On Replit:** press **Run**. That is the whole procedure.

**Anywhere else:**

```bash
npm install
npm run dev
```

Open <http://localhost:5000>.

The first boot expands a pre-seeded database that ships with the repository and
slides its timestamps up to the current hour, so the dashboard is populated and
*recent* whether you open it today or in six months. Measured cold start on a
laptop: **~8 s** on a fresh clone, **~6 s** afterwards.

---

## What you get

| Screen | What it shows |
| ------ | ------------- |
| `/` | KPI cards, per-site weather, a sortable table of every machine with its latest reading per metric, and a live alert feed |
| `/assets/:id` | A react-three-fiber floor plan of the whole site — machines extruded from their stored coordinates, tinted by status, with pulsing hotspots that open a sensor readout — plus telemetry charts and alert history |
| `/analytics` | Compare one metric across up to six machines, over 24 h to 60 d |
| `/design-system` | Living documentation: every colour token, the type scale, spacing, motion, and every component, rendered by the real components |

<!-- SCREENSHOT: /assets/6 with the 3D scene, docs/media/asset-detail.png -->
<!-- SCREENSHOT: /design-system colour section, docs/media/design-system.png -->

---

## Architecture in five lines

1. **React 19 + Vite** client, four routes, three.js and Recharts lazy-loaded per route.
2. **Express 5** serves the API and, in production, the built client — one process, one port.
3. **Drizzle + Postgres**: embedded PGlite by default, any Postgres via `DATABASE_URL`, same schema either way.
4. **`shared/types.ts`** is the contract both sides import, so an API change breaks the client at compile time.
5. **`src/styles/tokens.css`** is the only place a colour, size or duration is defined; everything else references it.

---

## Make it yours

### Use a real Postgres instead of the embedded one

Set one variable. Nothing else changes — same schema, same migrations, same queries.

```bash
DATABASE_URL=postgres://user:pass@host:5432/sitesignal npm run dev
```

On Replit, add it in the **Secrets** panel. The switch lives in
`server/db/client.ts`; the rest of the server never learns which driver it got.

### Swap Open-Meteo for another data source

`server/services/weather.ts` is a self-contained client: it fetches, shapes the
response into `AmbientSummary`, caches for 15 minutes and serves a stale copy if
the upstream fails. To use a different provider, keep the exported functions and
replace the middle:

1. Change `buildUrl()` to your endpoint (add the key from `process.env`).
2. Change `parse()` to map your response into `WeatherCurrent` and
   `WeatherForecastPoint` in `shared/types.ts`.
3. Leave `getAmbient()` alone — the cache, request coalescing and stale
   fallback are provider-agnostic.

The same shape works for anything ambient: an air-quality API, a building
management system, your own sensor gateway.

### Adapt it to a different domain

The app is not really about pumps. It is *entities positioned in space, each
emitting time series, each raising alerts*. That covers server racks, delivery
vans, greenhouse zones, retail floors, wind turbines.

| To change | Edit |
| --------- | ---- |
| The vocabulary (asset types, metrics, units, statuses) | `shared/types.ts` |
| The demo fleet: sites, machines, coordinates, alert text | `server/db/seed-data.ts` |
| How each metric behaves over time (baseline, daily cycle, drift, failure ramp) | `buildSeries()` in `server/db/seed.ts` |
| The shape of each machine in the 3D scene | `ASSET_GEOMETRY` in `src/components/asset-scene.tsx` |
| Colours, type scale, spacing, motion | `src/styles/tokens.css` — one file, and `/design-system` re-renders itself |
| Tables and columns | `server/db/schema.ts`, then `npm run db:generate` |

After changing the seed, rebuild the shipped dataset so forks get your version:

```bash
npm run db:reset      # regenerate the database
npm run db:snapshot   # write data/sitesignal-seed.tar.gz
```

---

## Commands

| Command | |
| ------- | - |
| `npm run dev` | Vite on the public port, Express behind it |
| `npm start` | Production: one process serving API and client |
| `npm run build` | Typecheck, then build the client |
| `npm run typecheck` | `tsc -b` across client, server and scripts |
| `npm run db:reset` | Rebuild the database from the seeder |
| `npm run db:snapshot` | Write the shipped snapshot from the current database |
| `npm run db:restore` | Restore the shipped snapshot, discarding local changes |
| `npm run db:generate` | Regenerate SQL migrations after a schema change |

## Configuration

Everything has a working default; see `.env.example`. The ones worth knowing:

| Variable | Default | |
| -------- | ------- | - |
| `PORT` | `5000` | The single public port. Replit injects it. |
| `DATABASE_URL` | *(unset)* | Set it to use a real Postgres instead of PGlite. |
| `SEED_READINGS` | `18000` | Row count target. Changes sampling resolution, never the 60-day range. |
| `WEATHER_CACHE_MINUTES` | `15` | Ambient-conditions cache window. |

---

## What is deliberately missing

No authentication, no roles, no tests, no multi-tenancy. This is a template for
the monitoring surface itself — adding those on top is your job, and they are
much easier to add to something that already renders.

## Credits

Ambient conditions from [Open-Meteo](https://open-meteo.com) (no API key).
Embedded Postgres by [PGlite](https://pglite.dev).

## License

MIT — see [LICENSE](./LICENSE).
