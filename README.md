# AnimeX

> Serverless anime streaming — Cloudflare Workers (scraper + HLS proxy) + React/Vite/Tailwind (frontend).

---

## Repo Structure

```
anime/
├── .node-version              ← pins Node 20 for Cloudflare build
├── worker/                    ← Cloudflare Worker (deployed as a Worker app)
│   ├── wrangler.toml
│   ├── package.json
│   └── src/index.js           ← Scraper · AES extractor · HLS proxy
└── frontend/                  ← React app (deployed as a Pages app)
    ├── vite.config.js
    ├── tailwind.config.js
    ├── package.json
    └── src/
        ├── App.jsx
        ├── index.css
        └── components/Player.jsx
```

---

## Deploying via Cloudflare Dashboard (Git Integration)

You will create **two separate apps** from the Cloudflare dashboard — one Worker and one Pages site. No GitHub Actions or API tokens needed.

---

### App 1 — The Worker (backend API + HLS proxy)

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. Click **Create** → **Worker**
3. At the top, switch to the **"Git"** tab (instead of Quick Edit)
4. Click **Connect to Git** → authorize GitHub → select **this repo**
5. Fill in the build settings:

   | Field | Value |
   |---|---|
   | **Production branch** | `main` |
   | **Root directory** | `worker` |
   | **Build command** | `npm install` |
   | **Deploy command** | *(leave blank — wrangler.toml handles it)* |

6. Click **Save and Deploy**
7. Cloudflare will assign a URL like:
   ```
   https://animex-worker.<your-subdomain>.workers.dev
   ```
   **Copy this URL** — you need it for the next step.

> Every `git push` to `main` will now auto-deploy the Worker. ✅

---

### App 2 — The Frontend (React + Vite → Cloudflare Pages)

1. In **Workers & Pages** → **Create** → **Pages**
2. Click **Connect to Git** → select **the same repo**
3. Fill in the build settings:

   | Field | Value |
   |---|---|
   | **Production branch** | `main` |
   | **Root directory** | `frontend` |
   | **Framework preset** | `Vite` |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |

4. Under **Environment variables** → Add:

   | Variable | Value |
   |---|---|
   | `VITE_API_BASE` | `https://animex-worker.<your-subdomain>.workers.dev` |

   *(Use the Worker URL you copied in step 1 of App 1)*

5. Click **Save and Deploy**
6. Cloudflare assigns a URL like:
   ```
   https://animex.<your-pages-subdomain>.pages.dev
   ```

> Every `git push` to `main` now auto-deploys both apps. ✅

---

## Local Development

```bash
# Terminal 1 — Worker
cd worker
npm install
npm run dev        # → http://localhost:8787

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev        # → http://localhost:5173
                   # (Vite auto-proxies /api/* and /proxy/* to :8787)
```

No `.env` file needed locally — the Vite proxy handles routing.

---

## Adapting to a Different Source Site

Edit these two things in [`worker/src/index.js`](./worker/src/index.js):

| Constant | What to change |
|---|---|
| `BASE_URL` | Root URL of your target site |
| `EMBED_DOMAIN` | Embed iframe host |
| Cheerio selectors in `scrapeLatest` / `scrapeEpisodes` | Match target site's HTML structure |

The `GOGOCDN_KEYS` are the public AES keys used by most Gogo-fork sites. Update if your target uses different values.

---

## HLS Pipeline (How the Proxy Works)

```
Browser
  │
  ├─ GET /proxy/hls?url=<remote .m3u8>
  │    Worker fetches remote manifest
  │    Rewrites every .ts line → /proxy/ts?url=<segment>
  │    Returns patched manifest (Content-Type: application/vnd.apple.mpegurl)
  │
  └─ GET /proxy/ts?url=<segment>
       Worker streams binary TS data back to browser
       (video/mp2t, CORS headers, cached 1 h)
```

This routes all media through the Worker, bypassing IP-binding and CORS restrictions at **zero extra cost** (no Cloudflare Stream storage needed).

---

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Navy | `#0D3A5C` | Deep background |
| Dark Blue | `#14456C` | Mid background |
| Azure | `#1B5A8C` | Glass surface |
| Gold | `#C9A24B` | Accent, CTA |
| Ivory | `#FAF7F0` | Body text |

---

## Player Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` | Seek ±10 s |
| `↑` / `↓` | Volume ±10% |
| `M` | Toggle mute |
| `F` | Toggle fullscreen |
| `Esc` | Close player |
