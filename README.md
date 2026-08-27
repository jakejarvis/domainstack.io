<p align="center">
<a href="https://domainstack.io"><img width="72" height="72" alt="Domainstack" src="https://github.com/user-attachments/assets/d76429cc-56cb-4859-bb41-f52131f093e9" /></a>
</p>
<p align="center">
<a href="https://domainstack.io"><strong>Domainstack</strong></a> — Domain Intelligence Made Easy
</p>
<br/>
<p align="center">
<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>
</p>

## Features

- **Instant domain reports**: WHOIS/RDAP data, DNS, certs, headers, hosting/email providers, and geolocation.
- **Domain tracking**: Verify ownership, monitor domains, and get important health alerts.
- **Provider detection**: Matches raw data against a large hosting, email, and DNS provider library.
- **SEO & metadata analysis**: Titles, meta tags, social previews, Open Graph images, canonicals, and `robots.txt`.
- **Screenshots & icons**: Server-side screenshots, favicon extraction, and provider logos.
- **Fast & private**: No sign-up required for reports.
- **Notifications & calendar sync**: Email/In-app alerts plus iCal feeds for expirations.
- **Advanced dashboard**: Filtering, sorting, bulk actions, and multiple view modes.
- **AI chat assistant**: Ask questions about any domain in natural language; powered by durable streaming with automatic reconnection.
- **MCP server**: AI-assisted domain lookups via [Model Context Protocol](https://modelcontextprotocol.io/).
- **Pro subscription**: Paid plan via Polar for higher tracking limits.
- **Reliable backend**: SWR caching with cron-based cache warming.

<p align="center">
<a href="https://domainstack.io"><img width="1149" height="552" alt="Screenshot 2026-02-21 at 11 16 04 AM" src="https://github.com/user-attachments/assets/15754f3d-82d1-4b8d-9b13-616c3ab9dd53" /></a>
</p>

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** + [**Base UI**](https://base-ui.com/)
- [**tRPC**](https://trpc.io/) + [**TanStack Query**](https://tanstack.com/query/latest) & [**TanStack Table**](https://tanstack.com/table/latest)
- [**PlanetScale Postgres**](https://planetscale.com/postgres) + [**Drizzle**](https://orm.drizzle.team/) + [**Upstash Redis**](https://upstash.com/) (rate limiting)
- [**Better Auth**](https://www.better-auth.com) (OAuth)
- [**Polar**](https://polar.sh/) (subscriptions)
- [**Workflow SDK**](https://workflow-sdk.dev/) (background jobs)
- [**AI SDK**](https://ai-sdk.dev/) + [**Vercel AI Gateway**](https://vercel.com/ai-gateway) (Stacky bot)
- [**Resend**](https://resend.com/) (email notifications)
- [**mapcn**](https://mapcn.vercel.app/) + [**CARTO Basemaps**](https://docs.carto.com/faqs/carto-basemaps) (web maps)
- [**Logo.dev**](https://www.logo.dev) (provider icons)
- [**IPLocate.io**](https://www.iplocate.io/) (geolocation)
- [**PostHog**](https://posthog.com/) (telemetry)
- **Vercel** (Edge Config, Blob Storage)
- **Turborepo** (monorepo)
- **Vitest** + **Playwright** (testing), **oxlint/oxfmt** (linting)

## Development

This is a **[Turborepo](https://turborepo.dev/docs) monorepo**.

### 1. Clone & install

```bash
git clone https://github.com/jakejarvis/domainstack.io.git
cd domainstack.io
pnpm install
```

### 2. Configure environment variables

Create `.env.local` in the `apps/web` directory and populate [required variables](apps/web/.env.example):

```bash
cp apps/web/.env.example apps/web/.env.local
```

At minimum, you'll need `DATABASE_URL` pointing to a Postgres database.

### 3. Set up the database

Apply Drizzle migrations to initialize the database schema:

```bash
pnpm db:migrate
```

### 4. Start development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## License

[MIT](LICENSE)
