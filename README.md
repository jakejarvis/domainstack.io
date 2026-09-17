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

### Local setup

Install Node.js 24.21.0, pnpm, and Docker, then:

```bash
git clone https://github.com/jakejarvis/domainstack.io.git
cd domainstack.io
pnpm install
pnpm dev
```

`pnpm dev` starts PostgreSQL 18 in Docker on `127.0.0.1:54329`, waits for it to become healthy, applies migrations, and starts the Turborepo development processes. Open [http://localhost:3000](http://localhost:3000). Authenticated pages are available through **Continue as local developer**; the local account is created on first use.

The first run safely appends missing defaults to the ignored `apps/web/.env.development.local`. Existing values are never replaced, and diagnostics report only whether integrations are configured:

```bash
pnpm dev:doctor
```

Redis, Polar, Blob, Resend, analytics, Edge Config, AI, and OAuth providers are optional for core local development. Add any integrations you want to `apps/web/.env.local`. To use Vercel Development variables, pull them manually:

```bash
cd apps/web
vercel env pull .env.local --environment=development
```

The generated development-local database URL has higher file precedence than a pulled Vercel URL. The process environment still has highest precedence.

### Database commands

The default backend is `docker`. Its named volume is scoped to the checkout, so data survives restarts and different checkouts do not share data. The fixed host port means only one checkout-local database can run at a time.

```bash
pnpm db:start
pnpm db:stop
pnpm db:migrate
pnpm db:push
pnpm db:studio
pnpm db:reset
```

`pnpm db:reset` removes only the current checkout's Docker volume or ignored native data directory. It refuses to run for an external database.

Set `LOCAL_BACKEND=native` to use locally installed PostgreSQL server tools, with data stored under the ignored `.tmp/` directory. To use a database that Domainstack does not manage, put `LOCAL_BACKEND=external` and an explicit `DATABASE_URL` in `apps/web/.env.development.local`. You can instead export both variables when running an individual database command.

### Codex and Claude cloud environments

Cloud agents should use native PostgreSQL and no hosted secrets. Configure either platform's setup command as:

```bash
bash scripts/cloud-setup.sh
```

The setup script selects the Node.js version in `.nvmrc`, enables Corepack so it uses the pnpm version declared by `packageManager`, installs dependencies with the frozen lockfile, installs Ubuntu PostgreSQL only when server tools are missing, and records the native backend. Database initialization and migrations remain part of `pnpm dev` and the root database commands.

See the platform documentation for persistent environment and setup-script configuration: [Codex cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment) and [Claude cloud environments](https://code.claude.com/docs/en/cloud-environments). Do not add Vercel or production secrets to these environments.

## License

[MIT](LICENSE)
