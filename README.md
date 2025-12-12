# 📚 [Domainstack](https://domainstack.io) - Domain Intelligence Tool

[Domainstack](https://domainstack.io) is an all-in-one app for exploring domain names. Search any domain (e.g., [`github.com`](https://domainstack.io/github.com)) and get instant insights including WHOIS/RDAP lookups, DNS records, SSL certificates, HTTP headers, hosting details, geolocation, and SEO signals.

![Screenshot of Domainstack domain analysis page for GitHub.com](https://github.com/user-attachments/assets/5a13d2c5-2d1c-4f70-bc52-a2742d43ebc6)

## 🚀 Features

- **Instant domain reports**: Registration, DNS, certificates, HTTP headers, hosting & email, and geolocation.
- **SEO insights**: Extract titles, meta tags, social previews, canonical data, and `robots.txt` signals.
- **Screenshots & favicons**: Server-side screenshots and favicon extraction, cached in Postgres with Vercel Blob storage.
- **Fast, private, no sign-up required for reports**: Live fetches with intelligent multi-layer caching.
- **Domain tracking dashboard**: Sign in to track domains you own, verify ownership, and receive expiration alerts.
- **Pro tier subscriptions**: Upgrade via [Polar](https://polar.sh) for expanded domain tracking limits (100 vs 5 domains).
- **Email notifications**: Configurable alerts for domain expiration, SSL certificate expiration, subscription lifecycle, and verification status changes.
- **Reliable data pipeline**: Postgres persistence with per-table TTLs (Drizzle) and event-driven background revalidation (Inngest).
- **Advanced dashboard**: Domain filtering by status/health/TLD, URL-persisted filters, bulk archive/delete actions, and sortable table/grid views.
- **Dynamic configuration**: Vercel Edge Config for runtime-adjustable domain suggestions and tier limits without redeployment.

## 🛠️ Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** components
- **tRPC** API with **TanStack Query** for data fetching and optimistic updates
- **TanStack Table** for sortable dashboard table view
- **Vercel Postgres** + **Drizzle ORM** with connection pooling
- **Better Auth** for authentication via OAuth
- **Polar** for subscription payments and customer portal (Pro tier)
- **Inngest** for event-driven background jobs (revalidation, expiry checks, domain re-verification)
- **Resend** + **React Email** for transactional email notifications
- **Vercel Edge Config** for runtime configuration (domain suggestions, tier limits)
- **Vercel Blob** for favicon/screenshot storage with Postgres metadata caching
- [**rdapper**](https://github.com/jakejarvis/rdapper) for RDAP lookups with WHOIS fallback
- **Puppeteer** (with `@sparticuz/chromium` on Vercel) for server-side screenshots
- **Mapbox** for IP geolocation maps
- **PostHog** for analytics and error tracking with sourcemap uploads and reverse proxy
- **Vitest** with React Testing Library and **Biome** for lint/format

## 🌱 Getting Started

### 1. Clone & install

```bash
git clone https://github.com/jakejarvis/domainstack.io.git
cd domainstack.io
pnpm install
```

### 2. Configure environment variables

Create `.env.local` and populate [required variables](.env.example):

```bash
cp .env.example .env.local
```

### 3. Run Drizzle database migrations & seeds

```bash
pnpm db:generate   # generate SQL from schema
pnpm db:migrate    # apply migrations to local Postgres
pnpm db:seed       # seed database (if needed)
```

### 4. Start development

The `dev` script uses `concurrently` to automatically start all local services and the Next.js dev server together:

```bash
pnpm dev
```

This single command boots:
- **Postgres** on `localhost:5432`
- **Inngest dev server** on `http://localhost:8288`
- **ngrok tunnel** with public HTTPS URL (for webhooks) and web UI on `http://localhost:4040`
- **Next.js dev server** on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000). Press `Ctrl+C` to stop all services at once.

> [!NOTE]
> The ngrok URL can be used for testing public endpoints (like [sandboxed Polar webhooks](https://polar.sh/docs/integrate/webhooks/endpoints#get-started)) during local development.
>
> **For persistent ngrok URLs:** Set both `NGROK_AUTHTOKEN` and `NGROK_URL` in `.env.local`. Get your auth token and create a free static domain at https://dashboard.ngrok.com/domains. This ensures the same URL every time you restart services.

> [!NOTE]
> On Linux, if `host.docker.internal` isn't available, add `extra_hosts` to the services in [`docker-compose.yml`](docker-compose.yml):
>
> ```yaml
> extra_hosts: ["host.docker.internal:host-gateway"]
> ```

## 🧰 Useful Commands

```bash
pnpm dev           # start all local services (Docker) + Next.js dev server
pnpm build         # compile production bundle
pnpm start         # serve compiled output for smoke tests
pnpm lint          # Biome lint/format checks
pnpm format        # apply Biome formatting
pnpm typecheck     # tsc --noEmit
pnpm test          # Vitest (watch mode)
pnpm test:run      # Vitest (single run)
pnpm test:ui       # Vitest UI
pnpm test:coverage # Vitest with coverage report

# Drizzle
pnpm db:generate   # generate SQL migrations from schema
pnpm db:push       # push the current schema to the database
pnpm db:migrate    # apply migrations to the database
pnpm db:studio     # open Drizzle Studio
pnpm db:seed       # run seed script (scripts/db/seed.ts)
```

## 📜 License

[MIT](LICENSE)

Toybrick by Ary Prasetyo from [Noun Project](https://thenounproject.com/browse/icons/term/toybrick/) (CC BY 3.0)
