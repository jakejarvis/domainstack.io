# 📚 [Domainstack](https://domainstack.io) - Domain Intelligence Tool

[Domainstack](https://domainstack.io) is an all-in-one app for exploring domain names. Search any domain (e.g., [`github.com`](https://domainstack.io/github.com)) and get instant insights including WHOIS/RDAP lookups, DNS records, SSL certificates, HTTP headers, hosting details, geolocation, and SEO signals.

![Screenshot of Domainstack domain analysis page for GitHub.com](https://github.com/user-attachments/assets/5a13d2c5-2d1c-4f70-bc52-a2742d43ebc6)

## 🚀 Features

- **Instant domain reports**: Registration, DNS, certificates, HTTP headers, hosting & email, and geolocation.
- **SEO insights**: Extract titles, meta tags, social previews, canonical data, and `robots.txt` signals.
- **Screenshots & favicons**: Server-side screenshots and favicon extraction, stored in Vercel Blob.
- **Fast, private, no sign-up**: Live fetches with smart caching.
- **Reliable data pipeline**: Postgres persistence (Drizzle), background revalidation (Inngest), and Redis for short-lived caching/locks.

## 🛠️ Tech Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **tRPC** API
- **Postgres** + **Drizzle ORM**
- **Inngest** for background jobs and scheduled revalidation
- **Upstash Redis** for caching and locks
- **Vercel Edge Config** for dynamic configuration (domain suggestions, rate limits)
- **Vercel Blob** for favicon/screenshot storage
- [**rdapper**](https://github.com/jakejarvis/rdapper) for RDAP lookups with WHOIS fallback
- **Puppeteer** (with `@sparticuz/chromium` on server) for screenshots
- **Mapbox** for IP geolocation maps
- **PostHog** analytics with sourcemap uploads
- **Vitest** for testing and **Biome** for lint/format

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
- **Neon wsproxy** on `localhost:5433` (WebSocket proxy used by the Neon serverless driver)
- **Redis** on `localhost:6379`
- **Serverless Redis HTTP (SRH)** on `http://localhost:8079` (Upstash-compatible REST proxy)
- **Inngest dev server** on `http://localhost:8288`
- **Next.js dev server** on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000). Press `Ctrl+C` to stop all services at once.

> [!NOTE]
> On Linux, if `host.docker.internal` isn't available, add `extra_hosts` to the Inngest service in [`docker-compose.yml`](docker-compose.yml):
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
