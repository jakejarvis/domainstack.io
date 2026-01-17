<p align="center">
<a href="https://domainstack.io"><img width="72" height="72" alt="Domainstack" src="https://github.com/user-attachments/assets/d76429cc-56cb-4859-bb41-f52131f093e9" /></a>
</p>
<p align="center">
<a href="https://domainstack.io"><strong>Domainstack</strong></a>: Domain Intelligence Made Easy
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
- **MCP server**: AI-assisted domain lookups via [Model Context Protocol](https://modelcontextprotocol.io/).
- **Pro subscription**: Paid plan via Polar for higher tracking limits.
- **Reliable backend**: Event-driven revalidation and TTL-based persistence.

<p align="center">
<a href="https://domainstack.io/github.com"><img width="600" height="315" alt="og" src="https://github.com/user-attachments/assets/4f327128-df7c-4b19-8648-cb7c85ac95b1" /></a>
</p>

## Tech Stack

- **Next.js 16** (App Router), **React 19**, **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** + [**Base UI**](https://x.com/colmtuite/status/1999535911126565050)
- **tRPC** + **TanStack Query** & **TanStack Table**
- **Postgres** (PlanetScale) + **Drizzle ORM** + **Upstash Redis** (rate limiting)
- **Better Auth** (OAuth)
- **Polar** (subscriptions)
- **Inngest** + [**Workflow DevKit**](https://useworkflow.dev/) (background jobs)
- **Resend** + **React Email**
- **Vercel** (Edge Config, Blob Storage)
- [**mapcn**](https://mapcn.vercel.app/) + [**CARTO Basemaps**](https://docs.carto.com/faqs/carto-basemaps)
- [**Logo.dev**](https://www.logo.dev)
- [**IPLocate.io**](https://www.iplocate.io/)
- **PostHog** (analytics)
- **Puppeteer** (screenshots)
- **Vitest** + **Playwright**, **Biome**

## Development

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
