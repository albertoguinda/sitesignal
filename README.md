# SiteSignal

[![ci](https://github.com/albertoguinda/sitesignal/actions/workflows/ci.yml/badge.svg)](https://github.com/albertoguinda/sitesignal/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests%20-%20193-passing-brightgreen)](#testing)
[![docker](https://img.shields.io/badge/docker-ready-blue)](#docker)

**Fork this repo, connect your IoT sensors, deploy to Replit -- you have a production monitoring dashboard with 3D visualization in under 10 minutes.**

SiteSignal is a remixable industrial monitoring template. It ships with real telemetry data, an interactive 3D floor plan, authentication, multi-tenancy, a documented design system, and a full test suite. Fork it, swap the data source for your own sensors, and you have a production-ready dashboard.

![Overview: KPI cards, per-site ambient conditions, sortable asset table and live alert feed](docs/media/overview.png)

![Clicking a pulsing hotspot in the 3D floor plan updates the sensor readout panel](docs/media/hotspot.gif)

---

## Key Features

- **3D Interactive Floor Plan** -- Built with react-three-fiber. Clickable hotspots pulse by severity, orbit controls let you navigate the space, and selecting a hotspot loads real-time sensor data into a side panel.
- **Remixable Template** -- Not a throwaway demo. Fork the repo, point it at your data, and build on top of a production architecture. The seed script generates 3 industrial sites, 18 machines, and 60 days of telemetry so you see real data immediately.
- **Design System** -- A living `/design-system` route renders every color token, type scale, spacing unit, and component variant live. No hunting through Figma for the right shade.
- **Production Architecture** -- React 19, Vite 8, Express 5, Drizzle ORM, PostgreSQL (PGlite for zero-config local dev). The same code runs locally and in Docker.
- **193 Tests** -- Full Vitest suite covering utilities, components, and API routes. Coverage reporting built in.
- **Multi-tenancy** -- Organizations, role-based access (admin/member/viewer), team invitations, and data isolation. Ready for SaaS deployment.
- **Magic Link Auth** -- Passwordless login with secure session cookies, rate limiting, and security headers. Swap in your email provider for production.

---

## Quick Start

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/sitesignal.git
cd sitesignal
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). That is it. PGlite runs embedded -- no database server required. The seed script has already loaded 3 sites, 18 machines, and 60 days of telemetry.

On Replit: import the repo, hit Run. The `.replit` config handles everything.

---

## How to Remix

SiteSignal is a template, not a closed product. Here is how to make it yours:

**1. Connect your own sensors**

Replace the seed data in `server/db/seed.ts` with your actual IoT telemetry pipeline. The schema in `server/db/schema.ts` defines `readings` and `alerts` -- insert rows from MQTT, HTTP webhooks, or any ingestion path.

**2. Change the floor plan**

Edit the 3D scene in `src/components/asset-scene.tsx`. The `Hotspot` component accepts severity levels and triggers the panel update. Swap the geometry for your own facility layout.

**3. Adjust the data model**

Add new asset types in `shared/types.ts`, extend the schema in `server/db/schema.ts`, run `npm run db:generate`, and the API + UI follow the shared contract.

**4. Deploy**

Push to GitHub, connect to Replit, and deploy. Or `docker compose up` for self-hosted.

---

## Architecture

```
PRESENTATION        React 19 + Vite 8 + Tailwind v4 + react-three-fiber
      |
APPLICATION         TanStack Query + React Router v8 + Auth context
      |
DOMAIN              shared/types.ts (TypeScript contract between client/server)
      |
INFRASTRUCTURE      Express 5 + Drizzle ORM + PostgreSQL (PGlite or external)
```

The type contract in `shared/types.ts` is the single source of truth. Server and client both import from it -- no drift, no `any`.

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | React 19, Vite 8, Tailwind v4 | UI, 3D rendering, styling |
| State | TanStack Query | Server state, caching, refetching |
| Routing | React Router v8 | Client routes, nested layouts |
| 3D | react-three-fiber + drei | Interactive floor plan |
| Charts | Recharts | Analytics time series |
| API | Express 5, Zod validation | REST endpoints, input validation |
| ORM | Drizzle ORM | Type-safe SQL, migrations |
| Database | PostgreSQL (PGlite embedded) | Zero-config local, production-ready |
| Auth | Magic links + HTTP-only cookies | Passwordless, secure sessions |

---

## Tech Stack

| Category | Technology | Version |
|----------|-----------|---------|
| Runtime | Node.js | 20.19+ (22.x recommended) |
| Frontend | React | 19.2 |
| Build | Vite | 8.2 |
| Styling | Tailwind CSS | v4 |
| 3D | react-three-fiber | 9.7 |
| Charts | Recharts | 3.10 |
| API | Express | 5.2 |
| ORM | Drizzle | 0.45 |
| Database | PostgreSQL / PGlite | embedded |
| Validation | Zod | 4.4 |
| Testing | Vitest | 4.1 |
| TypeScript | TypeScript | 7.0 |
| Containers | Docker | multi-stage |

---

## Screenshots

| View | Description |
|------|-------------|
| ![Overview](docs/media/overview.png) | **Dashboard** -- KPI cards, per-site ambient conditions, sortable asset table, live alert feed |
| ![Hotspot](docs/media/hotspot.gif) | **3D Floor Plan** -- Click a pulsing hotspot, sensor panel updates in real time |
| ![Asset Detail](docs/media/asset-detail.png) | **Asset Detail** -- Full telemetry view for a single machine with 3D context |
| ![Design System](docs/media/design-system.png) | **Design System** -- Every token, type scale, and component rendered live at `/design-system` |

---

## Testing

```bash
# Run all 193 tests
npm test

# Single run (CI mode)
npm run test:run

# Coverage report
npm run test:coverage

# Type checking
npm run typecheck
```

Tests live in `src/lib/__tests__/` and `server/__tests__/` and use Vitest with Testing Library. The CI workflow runs on every push.

---

## Deploy

### Replit (recommended for Buildathon)

1. Fork this repo on GitHub
2. Import into Replit
3. Hit Run

The `.replit` configuration handles Node version, port binding, and build commands. Deployment targets autoscale by default.

### Docker

```bash
docker compose up
```

Multi-stage Dockerfile produces a minimal production image. The compose file includes PostgreSQL. One command, full stack.

### Anywhere Else

```bash
npm run build
npm start
```

Binds to port 5000. Set `DATABASE_URL` for external PostgreSQL, or leave it unset for embedded PGlite.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | *(none)* | PostgreSQL connection string (omit for PGlite) |
| `PGLITE_DIR` | `./data/sitesignal` | PGlite data directory |
| `BASE_URL` | `http://localhost:5000` | Base URL for magic links |

---

## Credits

- Ambient conditions by [Open-Meteo](https://open-meteo.com)
- Embedded Postgres by [PGlite](https://pglite.dev)
- UI components by [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)
- 3D rendering by [react-three-fiber](https://github.com/pmndrs/react-three-fiber)

---

MIT -- see [LICENSE](./LICENSE)
