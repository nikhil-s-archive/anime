/**
 * AnimeX — Cloudflare Worker
 *
 * Routes:
 *   GET /api/latest          → Scrape latest anime listings
 *   GET /api/search?q=       → Scrape search results
 *   GET /api/episodes?url=   → Scrape episode list from an anime page
 *   GET /api/extract?url=    → Extract & decrypt HLS stream URL from embed
 *   GET /proxy/hls?url=      → Stateless HLS manifest reverse-proxy
 *   GET /proxy/ts?url=       → Stateless TS segment reverse-proxy
 *
 * Target site: gogoanime / anitaku pattern (most common Mangayomi source)
 * Adapt BASE_URL and selectors to your actual target.
 */

import * as cheerio from "cheerio";
import CryptoJS from "crypto-js";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = "https://anitaku.pe"; // ← change to your target
const EMBED_DOMAIN = "https://embtaku.pro"; // ← GogoCDN / VidStreaming embed host

/** Shared browser-like headers used for all outbound fetches */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
};

/** CORS headers returned on every response */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// ─── GogoCDN / VidStreaming Crypto Constants ──────────────────────────────────
// These are the well-known public keys used by GogoCDN embeds.
// If the site rotates them, update here.
const GOGOCDN_KEYS = {
  key: CryptoJS.enc.Utf8.parse("93422192433952489752342908585752"),
  secondKey: CryptoJS.enc.Utf8.parse("93422192433952489752342908585752"),
  iv: CryptoJS.enc.Utf8.parse("9262859232435825"),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...CORS_HEADERS,
    },
  });
}

function errorResponse(message, status = 500, detail = null) {
  return jsonResponse({ error: message, detail }, status);
}

/**
 * Fetch with timeout, custom headers, and optional referrer.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Safely fetch HTML text; throws a descriptive error on non-200.
 */
async function fetchHtml(url, extraHeaders = {}) {
  const res = await fetchWithTimeout(url, {
    headers: { ...BROWSER_HEADERS, ...extraHeaders },
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

// ─── Scraper: Latest Anime ────────────────────────────────────────────────────

async function scrapeLatest(page = 1) {
  const url = `${BASE_URL}/?page=${page}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = [];

  // Selector matches the standard Gogo/Anitaku homepage grid
  $("ul.items li").each((_, el) => {
    const $el = $(el);
    const a = $el.find("p.name a");
    const img = $el.find("img");
    const episodeText = $el.find("p.episode").text().trim();

    const title = a.attr("title") || a.text().trim();
    const href = a.attr("href") || "";
    const thumbnail = img.attr("src") || img.attr("data-src") || "";
    const episodeLabel = episodeText || null;

    if (title && href) {
      items.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        thumbnail: thumbnail.startsWith("http")
          ? thumbnail
          : thumbnail
            ? `${BASE_URL}${thumbnail}`
            : "",
        episodeLabel,
      });
    }
  });

  // Pagination
  const totalPages =
    parseInt($("ul.pagination-list li:last-child a").attr("data-page")) || 1;

  return { page, totalPages, items };
}

// ─── Scraper: Search ─────────────────────────────────────────────────────────

async function scrapeSearch(query, page = 1) {
  const encoded = encodeURIComponent(query);
  const url = `${BASE_URL}/search.html?keyword=${encoded}&page=${page}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  const items = [];

  $("ul.items li").each((_, el) => {
    const $el = $(el);
    const a = $el.find("p.name a");
    const img = $el.find("img");
    const released = $el.find("p.released").text().replace("Released:", "").trim();
    const title = a.attr("title") || a.text().trim();
    const href = a.attr("href") || "";
    const thumbnail = img.attr("src") || img.attr("data-src") || "";

    if (title && href) {
      items.push({
        title,
        url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
        thumbnail: thumbnail.startsWith("http")
          ? thumbnail
          : thumbnail
            ? `${BASE_URL}${thumbnail}`
            : "",
        released: released || null,
      });
    }
  });

  return { query, page, items };
}

// ─── Scraper: Episode List ────────────────────────────────────────────────────

async function scrapeEpisodes(animeUrl) {
  const html = await fetchHtml(animeUrl);
  const $ = cheerio.load(html);

  // Extract the movie ID needed for the AJAX episode list endpoint
  const movieId = $("#movie_id").attr("value") || "";
  const startEp = $("#episode_page li:first-child a").attr("ep_start") || "0";
  const endEp = $("#episode_page li:last-child a").attr("ep_end") || "0";

  let episodes = [];

  if (movieId) {
    // Gogo uses an AJAX endpoint to load the full episode list
    const ajaxUrl = `https://ajax.gogo-load.com/ajax/load-list-episode?ep_start=${startEp}&ep_end=${endEp}&id=${movieId}`;
    try {
      const ajaxHtml = await fetchHtml(ajaxUrl, { Referer: BASE_URL });
      const $a = cheerio.load(ajaxHtml);
      $a("ul#episode_related li").each((_, el) => {
        const $el = $a(el);
        const href = $el.find("a").attr("href")?.trim() || "";
        const epNum = $el.find("div.name").text().replace("EP", "").trim();
        if (href) {
          episodes.push({
            episode: epNum,
            url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          });
        }
      });
      // Episodes come reversed; sort numerically ascending
      episodes.sort((a, b) => parseFloat(a.episode) - parseFloat(b.episode));
    } catch (e) {
      // Fallback: parse inline episode links
      $("ul#episode_page li a").each((_, el) => {
        const href = $(el).attr("href") || "";
        if (href) {
          episodes.push({
            episode: $(el).text().trim(),
            url: href.startsWith("http") ? href : `${BASE_URL}${href}`,
          });
        }
      });
    }
  }

  // Metadata
  const title = $(".anime_info_body_bg h1").text().trim();
  const description = $("div.description").text().trim();
  const thumbnail =
    $(".anime_info_body_bg img").attr("src") || "";

  return {
    title,
    description,
    thumbnail,
    totalEpisodes: episodes.length,
    episodes,
  };
}

// ─── Extractor: GogoCDN / VidStreaming AES Decrypt ───────────────────────────

/**
 * Decrypt using CryptoJS AES with the well-known GogoCDN keys.
 */
function gogoDecrypt(encrypted, key, iv) {
  const decrypted = CryptoJS.AES.decrypt(encrypted, key, { iv });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Encrypt a string using CryptoJS AES (needed to build the signed request).
 */
function gogoEncrypt(plaintext, key, iv) {
  return CryptoJS.AES.encrypt(plaintext, key, { iv }).toString();
}

/**
 * Full GogoCDN extraction pipeline:
 *  1. Fetch embed page → extract encrypted token
 *  2. Decrypt token → build signed AJAX request
 *  3. Call AJAX endpoint → parse source URLs
 *  4. Return the highest-quality .m3u8 URL
 */
async function extractGogoCdn(embedUrl) {
  // ── Step 1: Fetch embed page ──────────────────────────────────────────────
  const embedPageHtml = await fetchHtml(embedUrl, {
    Referer: BASE_URL,
    Origin: BASE_URL,
  });

  // Extract the encrypted token from the script block or meta tag
  // Pattern: crypto-js encypted value in a <div> or window.crypto_key
  const encKeyMatch = embedPageHtml.match(
    /crypto-key['"]\s*content=['"]([\w+/=]+)['"]/
  );
  const encTokenMatch = embedPageHtml.match(
    /data-value=['"]([\w+/=]+)['"]/
  );

  // Also try the standard script-variable pattern used by older Gogo embeds
  const scriptKeyMatch = embedPageHtml.match(
    /var\s+(?:recaptchaKey|_0x\w+)\s*=\s*['"]([\w+/=]+)['"]/
  );

  // The encrypted data is usually in a form field named "data-value"
  let encryptedData =
    encTokenMatch?.[1] ||
    encKeyMatch?.[1] ||
    scriptKeyMatch?.[1] ||
    null;

  // Parse video ID from embed URL
  const urlObj = new URL(embedUrl);
  const videoId = urlObj.searchParams.get("id") || urlObj.pathname.split("/").pop();

  if (!videoId) {
    throw new Error("Could not extract video ID from embed URL");
  }

  // ── Step 2: Build signed AJAX request ────────────────────────────────────
  // Encrypt the video ID with the first key
  const encryptedVideoId = gogoEncrypt(
    videoId,
    GOGOCDN_KEYS.key,
    GOGOCDN_KEYS.iv
  );

  let ajaxParams;
  if (encryptedData) {
    // Decrypt the token, then append the encrypted video ID
    const decryptedToken = gogoDecrypt(
      encryptedData,
      GOGOCDN_KEYS.key,
      GOGOCDN_KEYS.iv
    );
    ajaxParams = `id=${encodeURIComponent(encryptedVideoId)}&${decryptedToken}`;
  } else {
    // Fallback: simple id-only request (works on some embed variants)
    ajaxParams = `id=${encodeURIComponent(encryptedVideoId)}&alias=${videoId}`;
  }

  // Encrypt the full param string with the second key for the final signature
  const encryptedParams = gogoEncrypt(
    ajaxParams,
    GOGOCDN_KEYS.secondKey,
    GOGOCDN_KEYS.iv
  );

  // ── Step 3: Call the AJAX source endpoint ────────────────────────────────
  const embedOrigin = `${urlObj.protocol}//${urlObj.hostname}`;
  const ajaxUrl = `${embedOrigin}/encrypt-ajax.php?data=${encodeURIComponent(encryptedParams)}&id=1`;

  const ajaxRes = await fetchWithTimeout(ajaxUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: embedUrl,
      Origin: embedOrigin,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!ajaxRes.ok) {
    throw new Error(`AJAX endpoint returned HTTP ${ajaxRes.status}`);
  }

  const ajaxJson = await ajaxRes.json();

  // ── Step 4: Decrypt the response and extract sources ─────────────────────
  if (!ajaxJson?.data) {
    throw new Error("No encrypted data in AJAX response");
  }

  const decryptedResponse = gogoDecrypt(
    ajaxJson.data,
    GOGOCDN_KEYS.secondKey,
    GOGOCDN_KEYS.iv
  );

  let sources;
  try {
    sources = JSON.parse(decryptedResponse);
  } catch {
    throw new Error("Failed to parse decrypted source JSON");
  }

  // The decrypted payload is { source: [...], source_bk: [...] }
  const allSources = [
    ...(sources?.source || []),
    ...(sources?.source_bk || []),
  ];

  if (!allSources.length) {
    throw new Error("No sources found in decrypted payload");
  }

  // Prefer HLS (.m3u8) streams, fall back to any available source
  const hlsSource =
    allSources.find(
      (s) => s.type === "hls" || s.file?.includes(".m3u8")
    ) || allSources[0];

  return {
    streamUrl: hlsSource.file,
    label: hlsSource.label || "auto",
    type: hlsSource.type || "hls",
    allSources: allSources.map((s) => ({
      file: s.file,
      label: s.label,
      type: s.type,
    })),
  };
}

// ─── HLS Reverse Proxy ────────────────────────────────────────────────────────

/**
 * Fetch a remote .m3u8 manifest, rewrite all segment and sub-manifest URLs
 * to route through this Worker, and return the patched manifest.
 *
 * URL rewriting rules:
 *  - Lines starting with # → pass through unchanged
 *  - Lines ending with .m3u8 → rewrite as /proxy/hls?url=<encoded>
 *  - Lines ending with .ts or .ts?... → rewrite as /proxy/ts?url=<encoded>
 *  - Bare relative paths → resolve against the manifest base URL first
 */
async function proxyHls(manifestUrl, workerOrigin) {
  const res = await fetchWithTimeout(manifestUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: new URL(manifestUrl).origin,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch manifest: HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  // Resolve relative URLs against the manifest's own base
  const base = new URL(manifestUrl);
  const baseDir = base.href.substring(0, base.href.lastIndexOf("/") + 1);

  const lines = rawText.split("\n");
  const rewritten = lines.map((line) => {
    const trimmed = line.trim();

    // Keep comments, tags, and empty lines intact
    if (!trimmed || trimmed.startsWith("#")) return line;

    // Resolve the absolute URL for this segment/manifest
    let absoluteUrl;
    try {
      absoluteUrl = new URL(trimmed).href; // already absolute
    } catch {
      absoluteUrl = new URL(trimmed, baseDir).href; // relative → absolute
    }

    // Sub-manifest (quality variant) → proxy through /proxy/hls
    if (
      absoluteUrl.includes(".m3u8") ||
      contentType.includes("mpegurl")
    ) {
      if (trimmed.endsWith(".m3u8") || trimmed.includes(".m3u8?")) {
        return `${workerOrigin}/proxy/hls?url=${encodeURIComponent(absoluteUrl)}`;
      }
    }

    // TS segment → proxy through /proxy/ts
    return `${workerOrigin}/proxy/ts?url=${encodeURIComponent(absoluteUrl)}`;
  });

  return new Response(rewritten.join("\n"), {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

/**
 * Transparently proxy a single .ts segment, forwarding all bytes and
 * preserving the content-type. Streams the response to avoid buffering
 * large segments in Worker memory.
 */
async function proxyTs(segmentUrl) {
  const res = await fetchWithTimeout(
    segmentUrl,
    {
      headers: {
        ...BROWSER_HEADERS,
        Referer: new URL(segmentUrl).origin,
      },
    },
    30000 // TS segments can be large; allow 30 s
  );

  if (!res.ok) {
    return new Response(`Upstream error: ${res.status}`, {
      status: res.status,
      headers: CORS_HEADERS,
    });
  }

  // Stream the binary body directly to the client
  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") || "video/mp2t",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    },
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const workerOrigin = `${url.protocol}//${url.host}`;

    // ── Preflight CORS ──────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only GET is supported for all data endpoints
    if (request.method !== "GET") {
      return errorResponse("Method not allowed", 405);
    }

    try {
      // ── /api/latest ──────────────────────────────────────────────────────
      if (pathname === "/api/latest") {
        const page = parseInt(searchParams.get("page") || "1");
        const data = await scrapeLatest(Math.max(1, page));
        return jsonResponse(data);
      }

      // ── /api/search ──────────────────────────────────────────────────────
      if (pathname === "/api/search") {
        const q = searchParams.get("q") || "";
        if (!q.trim()) return errorResponse("Missing query param `q`", 400);
        const page = parseInt(searchParams.get("page") || "1");
        const data = await scrapeSearch(q, Math.max(1, page));
        return jsonResponse(data);
      }

      // ── /api/episodes ────────────────────────────────────────────────────
      if (pathname === "/api/episodes") {
        const animeUrl = searchParams.get("url");
        if (!animeUrl) return errorResponse("Missing query param `url`", 400);
        // Basic allowlist — only proxy URLs from the target domain
        if (!animeUrl.startsWith(BASE_URL)) {
          return errorResponse("URL not in allowed domain", 403);
        }
        const data = await scrapeEpisodes(animeUrl);
        return jsonResponse(data);
      }

      // ── /api/extract ─────────────────────────────────────────────────────
      if (pathname === "/api/extract") {
        const embedUrl = searchParams.get("url");
        if (!embedUrl) return errorResponse("Missing query param `url`", 400);

        const data = await extractGogoCdn(embedUrl);
        return jsonResponse(data);
      }

      // ── /proxy/hls ───────────────────────────────────────────────────────
      if (pathname === "/proxy/hls") {
        const manifestUrl = searchParams.get("url");
        if (!manifestUrl)
          return errorResponse("Missing query param `url`", 400);
        // Validate URL to prevent SSRF against internal CF services
        const parsed = new URL(manifestUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return errorResponse("Invalid URL protocol", 400);
        }
        return proxyHls(manifestUrl, workerOrigin);
      }

      // ── /proxy/ts ────────────────────────────────────────────────────────
      if (pathname === "/proxy/ts") {
        const segmentUrl = searchParams.get("url");
        if (!segmentUrl)
          return errorResponse("Missing query param `url`", 400);
        const parsed = new URL(segmentUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          return errorResponse("Invalid URL protocol", 400);
        }
        return proxyTs(segmentUrl);
      }

      // ── 404 ──────────────────────────────────────────────────────────────
      return errorResponse(`Unknown route: ${pathname}`, 404);
    } catch (err) {
      console.error("[Worker Error]", err?.message, err?.stack);
      return errorResponse(
        "Internal server error",
        500,
        err?.message || "Unknown error"
      );
    }
  },
};
