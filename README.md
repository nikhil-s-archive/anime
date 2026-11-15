# AnimeX

> Serverless anime streaming — Cloudflare Workers backend + React/Vite/Tailwind frontend.

```
anime/
├── worker/                    # Cloudflare Worker
│   ├── wrangler.toml
│   ├── package.json
│   └── src/
│       └── index.js           # Scraper · AES extractor · HLS proxy
└── frontend/                  # React + Vite + Tailwind
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── package.json
    └── src/
        ├── main.jsx
        ├── index.css
        ├── App.jsx
        └── components/
            └── Player.jsx
```

---

## Quick Start (Dev)

### 1. Worker

```bash
cd worker
npm install
npm run dev        # wrangler dev → localhost:8787
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # vite → localhost:5173
```

Vite proxies `/api/*` and `/proxy/*` to `localhost:8787` automatically.

---

## Deployment

### Worker

```bash
cd worker
npx wrangler login
npm run deploy
# Note your worker URL: https://animex-worker.<subdomain>.workers.dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env → set VITE_API_BASE to your worker URL
npm run build
# Deploy dist/ to Cloudflare Pages / Vercel / Netlify / etc.
```

---

## Adapting to a Different Source

Edit **two** things in `worker/src/index.js`:

| Constant | Purpose |
|---|---|
| `BASE_URL` | Root URL of your target site |
| `EMBED_DOMAIN` | Embed iframe host |
| Cheerio selectors in `scrapeLatest` / `scrapeEpisodes` | Match target site's HTML |

The GogoCDN crypto keys (`GOGOCDN_KEYS`) are public constants used by most Gogo-based forks. If your target uses different keys, replace them.

---

## HLS Pipeline

```
Browser → GET /proxy/hls?url=<manifest>
  Worker fetches remote .m3u8
  Rewrites .ts URLs → /proxy/ts?url=<segment>
  Returns patched manifest (application/vnd.apple.mpegurl)

Browser → GET /proxy/ts?url=<segment>
  Worker streams binary TS segment
  Returns video/mp2t with CORS headers
```

This bypasses IP-binding and CORS restrictions at zero cost (no Cloudflare Stream storage).

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Navy | `#0D3A5C` | Background deep |
| Dark Blue | `#14456C` | Background mid |
| Azure | `#1B5A8C` | Glass surface |
| Gold | `#C9A24B` | Accent, CTA |
| Ivory | `#FAF7F0` | Body text |

---

## Keyboard Shortcuts (Player)

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10 s |
| `↑` / `↓` | Volume ±10% |
| `M` | Mute toggle |
| `F` | Fullscreen |
| `Esc` | Close player |
