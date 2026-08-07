# SiteSignal

[![ci](https://github.com/albertoguinda/sitesignal/actions/workflows/ci.yml/badge.svg)](https://github.com/albertoguinda/sitesignal/actions/workflows/ci.yml)
[![tests](https://img.shields.io/badge/tests-passing-brightgreen)](#testing)
[![docker](https://img.shields.io/badge/docker-ready-blue)](#docker)

**A production-ready industrial asset monitoring dashboard with authentication, multi-tenancy, and real-time telemetry.**

Three industrial sites, eighteen machines, sixty days of telemetry, live weather per site, a 3D floor plan you can click through, and a documented design system. Authentication with magic links, multi-organization support, and comprehensive testing included.

![Overview: KPI cards, per-site ambient conditions, sortable asset table and live alert feed](docs/media/overview.png)

![Clicking a pulsing hotspot in the 3D floor plan updates the sensor readout panel](docs/media/hotspot.gif)

---

## Features

### Core Functionality
- **Real-time Dashboard** — KPI cards, per-site weather, sortable asset table, and live alert feed
- **3D Floor Plan** — Interactive react-three-fiber visualization with clickable hotspots
- **Analytics** — Compare metrics across up to six machines over 24h to 60d
- **Design System** — Living documentation with every color token, type scale, and component

### Authentication & Security
- **Magic Link Auth** — Passwordless login via email, no passwords to manage
- **Session Management** — Secure HTTP-only cookies with automatic expiration
- **Rate Limiting** — Protection against brute force attacks
- **Security Headers** — CSRF, XSS, and clickjacking protection

### Multi-Tenancy
- **Organization Support** — Multiple organizations per user
- **Role-Based Access** — Admin, member, and viewer roles
- **Team Management** — Invite and remove team members
- **Data Isolation** — Sites and assets scoped to organizations

### Developer Experience
- **Type Safety** — Full TypeScript with shared types between client and server
- **Testing** — Unit tests with Vitest and Testing Library
- **Docker** — Production-ready containerization
- **Hot Reload** — Instant feedback during development

---

## Quick Start

### Prerequisites
- Node.js 20.19+ (recommended: 22.x)
- npm 10+

### Local Development

```bash
# Clone the repository
git clone https://github.com/albertoguinda/sitesignal.git
cd sitesignal

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5000](http://localhost:5000)

### Docker

```bash
# Build and run with Docker Compose
npm run docker:compose

# Or build and run manually
npm run docker:build
npm run docker:run
```

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                 PRESENTATION                     │
│  React 19 + Vite + Tailwind CSS v4              │
│  react-three-fiber (3D) + Recharts (charts)     │
├─────────────────────────────────────────────────┤
│                 APPLICATION                      │
│  TanStack Query + React Router v8               │
│  Auth context + Organization management         │
├─────────────────────────────────────────────────┤
│                   DOMAIN                         │
│  Shared types (TypeScript contract)             │
│  Business logic in server queries               │
├─────────────────────────────────────────────────┤
│               INFRASTRUCTURE                     │
│  Express 5 + Drizzle ORM                        │
│  PostgreSQL (PGlite embedded or external)        │
│  Open-Meteo (weather data)                      │
└─────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `shared/types.ts` | Contract between client and server |
| `server/db/schema.ts` | Database schema (Drizzle ORM) |
| `server/routes/auth.ts` | Authentication endpoints |
| `server/middleware/auth.ts` | Auth middleware |
| `src/lib/auth.ts` | Client-side auth context |
| `src/styles/tokens.css` | Design tokens (colors, spacing, typography) |

---

## Authentication

SiteSignal uses magic link authentication for a secure, passwordless experience.

### How It Works
1. User enters their email on the login page
2. Server generates a unique token and logs it (in development)
3. In production, an email with the magic link would be sent
4. User clicks the link and is authenticated
5. Session cookie is set for subsequent requests

### Development Mode
In development, the magic link is logged to the console and automatically verified for faster iteration.

### Production Setup
For production, integrate an email service (SendGrid, AWS SES, etc.) in `server/routes/auth.ts`.

---

## Multi-Tenancy

### Organization Structure
```
Organization
├── Members (admin, member, viewer)
├── Sites
│   ├── Assets
│   │   ├── Readings
│   │   └── Alerts
```

### Roles
- **Admin** — Full access, can manage members and settings
- **Member** — Can view and interact with data
- **Viewer** — Read-only access

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/magic-link` | Request magic link |
| GET | `/api/auth/verify?token=xxx` | Verify magic link |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Destroy session |

### Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/organizations` | List user's organizations |
| POST | `/api/organizations` | Create organization |
| GET | `/api/organizations/:id` | Get organization details |
| PUT | `/api/organizations/:id` | Update organization |
| DELETE | `/api/organizations/:id` | Delete organization |
| POST | `/api/organizations/:id/invite` | Invite member |
| DELETE | `/api/organizations/:id/members/:memberId` | Remove member |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/overview` | Dashboard KPIs and assets |
| GET | `/api/sites` | List all sites |
| GET | `/api/assets` | List all assets |
| GET | `/api/assets/:id` | Asset detail with telemetry |
| GET | `/api/alerts` | List alerts |
| GET | `/api/analytics/series` | Time series data |

---

## Testing

### Run Tests
```bash
# Run all tests
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage
```

### Test Structure
```
src/
├── lib/
│   └── __tests__/
│       └── format.test.ts    # Utility function tests
├── components/               # Component tests (add as needed)
└── routes/                   # Route tests (add as needed)
```

---

## Docker

### Dockerfile
Multi-stage build for minimal production image:
1. **Builder stage** — Installs dependencies and builds the app
2. **Production stage** — Copies only necessary files, runs as non-root user

### Docker Compose
Includes PostgreSQL for production use:
```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# Stop all services
docker compose down
```

### Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | *(none)* | PostgreSQL connection string |
| `PGLITE_DIR` | `./data/sitesignal` | PGlite data directory |
| `BASE_URL` | `http://localhost:5000` | Base URL for magic links |

---

## Development

### Commands
| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Apply migrations |
| `npm run db:reset` | Reset database |

### Adding New Features

1. **Define types** in `shared/types.ts`
2. **Add schema** in `server/db/schema.ts`
3. **Generate migration** with `npm run db:generate`
4. **Create routes** in `server/routes/`
5. **Add client hooks** in `src/lib/`
6. **Build components** in `src/components/`
7. **Write tests** in `src/__tests__/`

---

## Deployment

### Vercel/Netlify
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically on push

### Docker
```bash
# Build image
docker build -t sitesignal .

# Run container
docker run -p 5000:5000 -e DATABASE_URL=postgres://... sitesignal
```

### Traditional Hosting
```bash
# Build
npm run build

# Start
npm run start
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run `npm test` to ensure all tests pass
6. Submit a pull request

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Credits

- Ambient conditions by [Open-Meteo](https://open-meteo.com)
- Embedded Postgres by [PGlite](https://pglite.dev)
- UI components by [Radix UI](https://www.radix-ui.com/)
- Icons by [Lucide](https://lucide.dev/)
