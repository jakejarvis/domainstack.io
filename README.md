<p align="center"><a href="https://domainstack.io"><img width="64" height="64" alt="Domainstack" src="https://github.com/user-attachments/assets/d76429cc-56cb-4859-bb41-f52131f093e9" /></a><br/><a href="https://domainstack.io"><strong>Domainstack</strong></a> — Domain Intelligence Made Easy
<br/><br/>
<a href="https://vercel.com/oss"><img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" /></a></p>

## Features

- **Instant domain reports**: WHOIS/RDAP data, DNS, certs, headers, hosting/email providers, and geolocation.
- **Domain tracking**: Verify ownership, monitor domains, and get important health alerts.
- **Provider detection**: Matches raw data against a large hosting, email, and DNS provider library.
- **SEO & metadata analysis**: Titles, meta tags, social previews, Open Graph images, canonicals, and `robots.txt`.
- **Screenshots & icons**: Server-side screenshots, favicon extraction, and provider logos.
- **Fast & private**: No sign-up required for reports.
- **Notifications & calendar sync**: Email/in-app/push alerts plus iCal feeds for expirations.
- **Native iOS & Android app**: Expo-powered companion app with portfolio, push notifications, and full domain reports.
- **Advanced dashboard**: Filtering, sorting, bulk actions, and multiple view modes.
- **AI chat assistant**: Ask questions about any domain in natural language; powered by durable streaming with automatic reconnection.
- **MCP server**: AI-assisted domain lookups via [Model Context Protocol](https://modelcontextprotocol.io/).
- **Pro subscription**: Paid plan via Polar for higher tracking limits.
- **Reliable backend**: SWR caching with cron-based cache warming.

<p align="center">
<a href="https://domainstack.io"><img width="1149" height="552" alt="Screenshot 2026-02-21 at 11 16 04 AM" src="https://github.com/user-attachments/assets/15754f3d-82d1-4b8d-9b13-616c3ab9dd53" /></a>
</p>

## Tech Stack

### Web (`apps/web`)

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** + [**Base UI**](https://base-ui.com/)
- **tRPC** + **TanStack Query** & **TanStack Table**
- **Postgres** (PlanetScale) + **Drizzle ORM** + **Upstash Redis** (rate limiting)
- **Better Auth** (OAuth)
- **Polar** (subscriptions)
- [**Workflow DevKit**](https://useworkflow.dev/) (background jobs)
- [**AI SDK**](https://ai-sdk.dev/) + [**AI Gateway**](https://vercel.com/ai-gateway)
- **Resend** + **React Email**
- **Vercel** (Edge Config, Blob Storage)
- [**mapcn**](https://mapcn.vercel.app/) + [**CARTO Basemaps**](https://docs.carto.com/faqs/carto-basemaps)
- [**Logo.dev**](https://www.logo.dev)
- [**IPLocate.io**](https://www.iplocate.io/)
- **PostHog** (analytics)

### Native (`apps/native`)

- **Expo** + **React Native**
- **Uniwind**
- **tRPC** + **TanStack Query**
- **Better Auth** (with native Apple & Google platform bindings)
- **PostHog** (analytics)

## Project Structure

This is a **[Turborepo](https://turborepo.dev/docs) monorepo**:

```
domainstack.io/
├── apps/
│   ├── web/                 # Next.js web application
│   └── native/              # Expo / React Native mobile app (iOS + Android)
├── packages/
│   ├── analytics/           # PostHog client/server analytics
│   ├── api/                 # tRPC routers (shared by web + native)
│   ├── auth/                # Better Auth server + client
│   ├── blob/                # Vercel Blob storage helpers
│   ├── constants/           # Shared constants (enums, TTLs, validation)
│   ├── db/                  # Drizzle schema, migrations, and query layer
│   ├── email/               # React Email templates + Resend client
│   ├── image/               # Image processing helpers
│   ├── logger/              # Pino logger
│   ├── polar/               # Polar (subscriptions) client
│   ├── redis/               # Upstash Redis + rate limiting
│   ├── safe-fetch/          # SSRF-safe fetch wrapper
│   ├── screenshot/          # Server-side screenshot pipeline
│   ├── server/              # Domain intelligence services (DNS, TLS, SEO, …)
│   ├── types/               # Shared TypeScript types
│   ├── typescript-config/   # Shared TypeScript configs
│   ├── ui/                  # Shared web UI primitives (Base UI + Tailwind)
│   └── utils/               # Framework-agnostic utilities
└── turbo.json               # Turborepo task configuration
```

## Development

### 1. Clone & install

```bash
git clone https://github.com/jakejarvis/domainstack.io.git
cd domainstack.io
pnpm install
```

### 2. Configure environment variables

Create `.env.local` files in each app directory and populate the required variables:

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/native/.env.example apps/native/.env.local   # only if running the native app
```

> [!TIP]
> At minimum, you'll need `DATABASE_URL` pointing to a Postgres database. See [`apps/web/.env.example`](apps/web/.env.example) and [`apps/native/.env.example`](apps/native/.env.example) for the full list.

### 3. Set up the database

Apply Drizzle migrations to initialize the database schema:

```bash
pnpm db:migrate
```

### 4. Start development

Run the web app:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

To run the native app against the local API:

```bash
pnpm --filter @domainstack/native dev
```

Then press `i` (iOS Simulator) or `a` (Android Emulator), or scan the QR code with an [Expo Dev Client](https://docs.expo.dev/develop/development-builds/introduction/) build.

## License

[MIT](LICENSE)
