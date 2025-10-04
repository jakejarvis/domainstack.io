# 🦉 Hoot - Domain Intelligence Tool

[Hoot.sh](https://hoot.sh) is a all-in-one app for exploring domain names. Easily search for any domain (like [`github.com`](https://hoot.sh/github.com)) and get instant insights including WHOIS info, DNS records, SSL certificates, HTTP headers, hosting details, and geolocation.

![Screenshot of Hoot domain analysis page for GitHub.com](https://github.com/user-attachments/assets/fa82ad38-7af3-46f6-94a2-901e45c12af1)

---

## 🚀 Features

- **Super Simple Search:** Enter any domain name and instantly view everything you need.
- **Comprehensive Reports:** See registration info, hosting & email, DNS records, SSL certificates, and HTTP headers.
- **Interactive UI:** Expand/collapse sections, copy data, and enjoy beautiful dark mode.
- **Fast & Private:** Data is fetched live, with caching for speed—no sign-up required.
- **Favicons & Screenshots:** Extract favicons and capture homepage screenshots, cached via UploadThing for quick reuse.

---

## 🛠️ Tech Stack

- **Next.js 15** (App Router)
- **React 19**
- **TypeScript**
- **Tailwind CSS v4**
- **tRPC** API endpoints
- **Upstash Redis** for caching
- **UploadThing** for favicon & screenshot storage
- **rdapper** for RDAP registration lookups with WHOIS fallback
- **Puppeteer** for server-side screenshots
- **Mapbox** for embedded IP geolocation maps
- **PostHog** for product analytics
- **Biome** linting and formatting

---

## 🌱 Getting Started

1. **Clone & install dependencies:**  
   ```bash
   git clone https://github.com/jakejarvis/hoot.git
   cd hoot
   pnpm install
   ```

2. **Start the dev server:**  
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

3. **(Optional) Configure `.env.local`:**  
   See `.env.example` for Redis and UploadThing credentials (needed for caching and favicon/screenshot features).

   Useful keys:
   - `BLOB_SIGNING_SECRET` (required in production)
   - `UPLOADTHING_TOKEN` (UploadThing server API key)
   - `UPLOADTHING_APP_ID` (UploadThing app identifier for canonical ufs URLs)
   - `FAVICON_TTL_SECONDS`, `SCREENSHOT_TTL_SECONDS` (optional TTLs)
   - `HOOT_USER_AGENT` (optional UA override)
   - `PUPPETEER_SKIP_DOWNLOAD=1` on Vercel to skip full `puppeteer` download

---

## ⏲️ Cron (pruning old assets)

- Schedule any external cron (GitHub Actions, Cloudflare Workers Cron, etc.) to call `GET /api/cron/blob-prune` with header `authorization: Bearer $CRON_SECRET`.

Example GitHub Actions snippet:

```yaml
name: Prune old assets
on:
  schedule:
    - cron: "0 * * * *" # hourly
jobs:
  prune:
    runs-on: ubuntu-latest
    steps:
      - name: Call prune endpoint
        run: |
          curl -fsSL -H "authorization: Bearer $CRON_SECRET" \
            $PRUNE_URL
        env:
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
          PRUNE_URL: ${{ secrets.PRUNE_URL }} # e.g. https://your.app/api/cron/blob-prune
```

## 📜 License

[MIT](LICENSE)

Owl logo by [Jordy Madueño](https://thenounproject.com/creator/jordymadueno/) from [Noun Project](https://thenounproject.com/) (CC BY 3.0).
