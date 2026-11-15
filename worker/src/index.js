/**
 * AnimeX — Cloudflare Worker
 * Source: AniKoto (anikototv.bz) — Ported from Mangayomi extension
 *
 * Endpoints:
 *   GET /api/latest            → Scrape latest updated anime
 *   GET /api/popular           → Scrape most viewed anime
 *   GET /api/search?q=&page=   → Search anime by keyword
 *   GET /api/episodes?url=     → Scrape details & episodes list for anime
 *   GET /api/extract?url=      → Extract & decrypt stream m3u8 for an episode
 *   GET /api/stream?url=       → (Alias for /api/extract)
 *   GET /proxy/hls?url=        → Stateless HLS manifest reverse proxy (rewrites .ts & sub-.m3u8)
 *   GET /proxy/ts?url=         → Stateless TS segment reverse proxy (streams bytes)
 */

import * as cheerio from "cheerio";

// ─── Configuration ────────────────────────────────────────────────────────────

const BASE_URL = "https://anikototv.bz";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const BASE_HEADERS = {
  "User-Agent": UA,
  Referer: BASE_URL + "/",
  "Accept-Language": "en-US,en;q=0.9",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
};

const AJAX_HEADERS = {
  "User-Agent": UA,
  Referer: BASE_URL + "/",
  "X-Requested-With": "XMLHttpRequest",
  Accept: "application/json, text/javascript, */*; q=0.01",
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// MegaPlay AES-256-CBC constants
const MEGAPLAY_ENC_KEY = "i?LMTAx0Q6,:}50U"; // padded to 32 bytes
const MEGAPLAY_ENC_IV = "W0;27ToaUpl_P%'c";  // 16 bytes
const MEGAPLAY_CDN_SECRET = "MpCdnT0k3n!9f2K#xQ7vL5mR8wN1pY4s";
const MEGAPLAY_TOKEN_TTL = 21600; // 6 hours

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

function errorResponse(msg, status = 500, detail = null) {
  return jsonResponse({ error: msg, detail }, status);
}

async function timedFetch(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchText(url, headers = {}) {
  const res = await timedFetch(url, {
    headers: { ...BASE_HEADERS, ...headers },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

async function fetchJson(url, headers = {}) {
  const res = await timedFetch(url, {
    headers: { ...AJAX_HEADERS, ...headers },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

function resolveUrl(href, base) {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  return new URL(href, base).href;
}

// ─── Decryption & HMAC Signing (Standard Web Crypto API) ──────────────────────

async function decodeMegaplayEnc(enc, logs = []) {
  try {
    let b64 = enc.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4 !== 0) b64 += "=";
    const binStr = atob(b64);
    const cipherBytes = new Uint8Array(binStr.length);
    for (let i = 0; i < binStr.length; i++) cipherBytes[i] = binStr.charCodeAt(i);

    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < MEGAPLAY_ENC_KEY.length && i < 32; i++) {
      keyBytes[i] = MEGAPLAY_ENC_KEY.charCodeAt(i);
    }

    const ivBytes = new Uint8Array(16);
    for (let i = 0; i < MEGAPLAY_ENC_IV.length && i < 16; i++) {
      ivBytes[i] = MEGAPLAY_ENC_IV.charCodeAt(i);
    }

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    const decryptedBuf = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: ivBytes },
      cryptoKey,
      cipherBytes
    );

    const decStr = new TextDecoder().decode(decryptedBuf);
    const parsed = JSON.parse(decStr);

    if (typeof parsed === "string") return parsed;
    if (parsed?.file) return parsed.file;
    if (Array.isArray(parsed) && parsed.length) return parsed[0].file || parsed[0].url || "";
    if (parsed?.sources) {
      if (typeof parsed.sources === "string") return parsed.sources;
      if (parsed.sources.file) return parsed.sources.file;
      if (Array.isArray(parsed.sources) && parsed.sources.length) return parsed.sources[0].file || "";
    }
  } catch (e) {
    logs.push(`decodeMegaplayEnc error: ${e.message}`);
    console.error("[decodeMegaplayEnc] error:", e.message);
  }
  return "";
}

async function signCdnUrl(url) {
  if (!url || /[?&]token=/.test(url)) return url;
  const m = String(url).match(/\/([a-f0-9]{32})\/([a-f0-9]{32})\//i);
  if (!m) return url;
  const path = m[1].toLowerCase() + "/" + m[2].toLowerCase();
  const expiry = Math.floor(Date.now() / 1000) + MEGAPLAY_TOKEN_TTL;
  const msg = `${expiry}|${path}`;

  const textEnc = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    textEnc.encode(MEGAPLAY_CDN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", hmacKey, textEnc.encode(msg));
  const b64url = (bytes) => {
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const token = `${b64url(textEnc.encode(msg))}.${b64url(new Uint8Array(sigBuf))}`;
  return url + (url.includes("?") ? "&" : "?") + "token=" + token;
}

// ─── Scrapers ─────────────────────────────────────────────────────────────────

function parseList($) {
  const items = [];
  let els = $("#list-items .item");
  if (els.length === 0) els = $(".item");

  els.each((_, el) => {
    const $el = $(el);
    const nameEl = $el.find(".name").first();
    if (!nameEl.length) return;

    let href = nameEl.attr("href") || "";
    if (!href) href = $el.find(".ani a, .poster a").first().attr("href") || "";
    if (!href) href = $el.attr("href") || "";
    if (!href) return;

    const title = (nameEl.text() || nameEl.attr("data-jp") || "").trim();
    if (!title) return;

    const imgEl = $el.find("img").first();
    const thumbnail = imgEl.attr("src") || imgEl.attr("data-src") || "";

    const subEp = $el.find(".ep-status.sub span").text().trim();
    const dubEp = $el.find(".ep-status.dub span").text().trim();
    const episodeLabel = subEp ? `Ep ${subEp}` : dubEp ? `Ep ${dubEp}` : null;

    items.push({
      title,
      url: resolveUrl(href, BASE_URL),
      thumbnail: thumbnail.startsWith("http")
        ? thumbnail
        : thumbnail
          ? resolveUrl(thumbnail, BASE_URL)
          : "",
      episodeLabel,
    });
  });
  return items;
}

function hasNextPage($) {
  const pagi = $(".pagination").text() || "";
  return pagi.includes("›") || pagi.includes("»");
}

async function scrapeLatest(page = 1) {
  const html = await fetchText(`${BASE_URL}/filter?sort=recently_updated&page=${page}`);
  const $ = cheerio.load(html);
  return { page, hasNextPage: hasNextPage($), items: parseList($) };
}

async function scrapePopular(page = 1) {
  const html = await fetchText(`${BASE_URL}/most-viewed?page=${page}`);
  const $ = cheerio.load(html);
  return { page, hasNextPage: hasNextPage($), items: parseList($) };
}

async function scrapeSearch(query, page = 1) {
  const html = await fetchText(
    `${BASE_URL}/filter?keyword=${encodeURIComponent(query)}&page=${page}`
  );
  const $ = cheerio.load(html);
  return { query, page, hasNextPage: hasNextPage($), items: parseList($) };
}

function extractSlug(url) {
  const path = url.replace(/^https?:\/\/[^/]+/, "");
  const m = path.match(/\/(?:watch|anime)\/([^/?#]+)/);
  return m ? m[1] : "";
}

async function scrapeEpisodes(animeUrl) {
  const html = await fetchText(animeUrl);
  const $ = cheerio.load(html);

  // Title
  let title = $("h1").first().text().trim();
  if (!title) {
    const og = $("meta[property='og:title']").attr("content") || "";
    title = og.replace(/^Watch\s+/i, "").replace(/\s+Episode.*$/i, "").trim();
  }

  // Thumbnail
  let thumbnail = "";
  $("img").each((_, el) => {
    if (thumbnail) return;
    const src = $(el).attr("src") || "";
    if (src.includes("anipixcdn") || src.includes("chiaki.site")) thumbnail = src;
  });
  if (!thumbnail) thumbnail = $("meta[property='og:image']").attr("content") || "";

  // Description
  let description = $(".synopsis, .synopsis-full, .series-blurb__full").first().text().trim();
  if (!description) description = $("meta[name='description']").attr("content") || "";

  // Genres
  let genres = [];
  $(".info span").each((_, el) => {
    const t = $(el).text().trim();
    if (t.includes(",") && genres.length === 0) {
      const parts = t.split(",").map((s) => s.trim()).filter((s) => s.length > 1 && s.length < 40);
      if (parts.length > 1) genres = parts;
    }
  });

  // Anime ID from #watch-main
  let animeId = $("#watch-main").attr("data-id") || "";
  if (!animeId) {
    const m =
      html.match(/data-id="(\d+)"[^>]*id="watch-main"/) ||
      html.match(/id="watch-main"[^>]*data-id="(\d+)"/) ||
      html.match(/data-id="(\d+)"/);
    if (m) animeId = m[1];
  }

  const slug = extractSlug(animeUrl);
  const episodes = [];

  if (animeId) {
    try {
      const epRes = await timedFetch(`${BASE_URL}/ajax/episode/list/${animeId}?vrf=`, {
        headers: { ...AJAX_HEADERS, Referer: animeUrl },
      });
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData?.status === 200 && epData.result) {
          const $ep = cheerio.load(epData.result);
          const seen = {};
          $ep("a[data-num]").each((_, el) => {
            const $a = $ep(el);
            const epNum = $a.attr("data-num") || "";
            const malId = $a.attr("data-mal") || "";
            const timestamp = $a.attr("data-timestamp") || "";
            const ids = $a.attr("data-ids") || "";
            if (!epNum || seen[epNum]) return;
            seen[epNum] = true;

            const rawText = ($a.text() || "").trim().replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");
            const titlePart = rawText.replace(new RegExp("^" + epNum + "\\s*"), "").trim();
            const label = "Episode " + epNum + (titlePart ? ": " + titlePart : "");

            const hasSub = $a.attr("data-sub") === "1";
            const hasDub = $a.attr("data-dub") === "1";
            const badge = hasSub && hasDub ? "Sub · Dub" : hasSub ? "Sub" : hasDub ? "Dub" : "";

            episodes.push({
              episode: epNum,
              label,
              badge,
              url: `${slug}||${epNum}||${malId}||${timestamp}||${ids}`,
            });
          });
        }
      }
    } catch (e) {
      console.error("[episodes] AJAX error:", e.message);
    }
  }

  // Episodes from site are chronological (1, 2, 3...)
  return {
    title,
    description,
    thumbnail,
    genres,
    slug,
    animeId,
    totalEpisodes: episodes.length,
    episodes,
  };
}

// ─── Stream Extractors ────────────────────────────────────────────────────────

async function fetchServerList(ids, logs = []) {
  if (!ids) {
    logs.push("fetchServerList: no ids provided");
    return { sub: [], dub: [] };
  }
  try {
    const res = await timedFetch(`${BASE_URL}/ajax/server/list?servers=${encodeURIComponent(ids)}`, {
      headers: AJAX_HEADERS,
    });
    logs.push(`fetchServerList HTTP ${res.status}`);
    if (!res.ok) return { sub: [], dub: [] };
    let data = await res.json();
    let html = data?.result || "";

    const $ = cheerio.load(html);
    const sub = [], dub = [];

    $(".type[data-type]").each((_, typeEl) => {
      const $t = $(typeEl);
      const isDub = ($t.attr("data-type") || "") === "dub";
      const bucket = isDub ? dub : sub;

      $t.find("li[data-link-id]").each((_, li) => {
        const $li = $(li);
        const linkId = $li.attr("data-link-id") || "";
        const name = ($li.text() || "").trim().slice(0, 20) || "Server";
        if (linkId) bucket.push({ linkId, name });
      });
    });

    if (sub.length === 0 && dub.length === 0) {
      $("li[data-link-id]").each((_, li) => {
        const $li = $(li);
        const linkId = $li.attr("data-link-id") || "";
        const name = ($li.text() || "").trim() || "Server";
        if (linkId) sub.push({ linkId, name });
      });
    }

    logs.push(`fetchServerList found sub=${sub.length}, dub=${dub.length}`);
    return { sub, dub };
  } catch (e) {
    logs.push(`fetchServerList error: ${e.message}`);
    return { sub: [], dub: [] };
  }
}

async function resolveLinkId(linkId, logs = []) {
  try {
    const res = await timedFetch(`${BASE_URL}/ajax/server?get=${encodeURIComponent(linkId)}`, {
      headers: AJAX_HEADERS,
    });
    logs.push(`resolveLinkId HTTP ${res.status}`);
    if (!res.ok) return "";
    const data = await res.json();
    if (!data?.result) {
      logs.push("resolveLinkId no data.result");
      return "";
    }
    if (typeof data.result === "string") return data.result;
    return data.result.url || data.result.link || "";
  } catch (e) {
    logs.push(`resolveLinkId error: ${e.message}`);
    return "";
  }
}

async function extractGetSources(embedUrl, audioLabel, logs = []) {
  try {
    const hostM = embedUrl.match(/^(https?:\/\/[^/]+)/);
    if (!hostM) {
      logs.push(`extractGetSources: no host in ${embedUrl}`);
      return [];
    }
    const apiHost = hostM[1];

    let getSrcId = "";
    try {
      const pageRes = await timedFetch(embedUrl, {
        headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
      });
      logs.push(`embedPage ${apiHost} HTTP ${pageRes.status}`);
      const pageBody = await pageRes.text();
      const m = pageBody.match(/data-id="(\d+)"/) || pageBody.match(/<title>File (\d+)/i);
      if (m) getSrcId = m[1];
      else logs.push(`data-id not in embed HTML (len ${pageBody.length})`);
    } catch (e) {
      logs.push(`embedPage error: ${e.message}`);
    }
    if (!getSrcId) return [];

    logs.push(`calling getSources?id=${getSrcId}`);
    const srcData = await fetchJson(`${apiHost}/stream/getSources?id=${getSrcId}`, {
      Referer: apiHost + "/",
      "X-Requested-With": "XMLHttpRequest",
    });

    let m3u8 = "";
    if (srcData.sources) {
      if (typeof srcData.sources === "string") m3u8 = srcData.sources;
      else if (srcData.sources.file) m3u8 = srcData.sources.file;
      else if (Array.isArray(srcData.sources) && srcData.sources.length)
        m3u8 = srcData.sources[0].file || srcData.sources[0].url || "";
    }
    if (!m3u8 && srcData.enc) {
      logs.push(`decrypting enc (len ${srcData.enc.length})`);
      m3u8 = await decodeMegaplayEnc(srcData.enc, logs);
    }
    if (!m3u8) {
      logs.push("extractGetSources: decrypted m3u8 is empty");
      return [];
    }

    m3u8 = await signCdnUrl(m3u8);
    logs.push(`extractGetSources success: ${m3u8.slice(0, 40)}...`);

    const subtitles = (srcData.tracks || [])
      .filter((t) => t.file && t.kind !== "thumbnails")
      .map((t) => ({
        url: t.file,
        label: t.label || "Subtitle",
        lang: (t.file.match(/_([a-z]{3})\.vtt/i) || [])[1] || (t.label || "").toLowerCase().slice(0, 2) || "en",
        default: !!t.default,
      }));

    logs.push(`extractGetSources subtitles count: ${subtitles.length}`);

    return {
      streams: [
        {
          url: m3u8,
          quality: audioLabel || "Auto",
          headers: { "User-Agent": UA, Referer: apiHost + "/" },
          server: apiHost,
        },
      ],
      subtitles,
    };
  } catch (e) {
    logs.push(`extractGetSources error: ${e.message}`);
    return null;
  }
}

async function extractVidtube(embedUrl, audioLabel, logs = []) {
  try {
    const pageRes = await timedFetch(embedUrl, {
      headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
    });
    logs.push(`vidtube page HTTP ${pageRes.status}`);
    const html = await pageRes.text();
    const idM = html.match(/getSourcesNew\?id=(\d+)/) || html.match(/<title>File (\d+)/i);
    if (!idM) {
      logs.push("vidtube fileId not found");
      return null;
    }
    const fileId = idM[1];
    const typeM = embedUrl.match(/\/(sub|dub)(?:[?#]|$)/);
    const type = typeM ? typeM[1] : "sub";

    const srcData = await fetchJson(
      `https://vidtube.site/stream/getSourcesNew?id=${fileId}&type=${type}`,
      { Referer: "https://vidtube.site/", "X-Requested-With": "XMLHttpRequest" }
    );

    let m3u8 = "";
    if (srcData.sources) {
      if (typeof srcData.sources === "string") m3u8 = srcData.sources;
      else if (srcData.sources.file) m3u8 = srcData.sources.file;
      else if (Array.isArray(srcData.sources) && srcData.sources.length)
        m3u8 = srcData.sources[0].file || srcData.sources[0].url || "";
    }
    if (!m3u8 && srcData.enc) m3u8 = await decodeMegaplayEnc(srcData.enc, logs);
    if (!m3u8) {
      logs.push("vidtube decrypted m3u8 empty");
      return null;
    }

    m3u8 = await signCdnUrl(m3u8);

    const subtitles = (srcData.tracks || [])
      .filter((t) => t.file && t.kind !== "thumbnails")
      .map((t) => ({
        url: t.file,
        label: t.label || "Subtitle",
        lang: (t.file.match(/_([a-z]{3})\.vtt/i) || [])[1] || (t.label || "").toLowerCase().slice(0, 2) || "en",
        default: !!t.default,
      }));

    return {
      streams: [
        {
          url: m3u8,
          quality: audioLabel || "Auto",
          headers: { "User-Agent": UA, Referer: "https://vidtube.site/" },
          server: "vidtube.site",
        },
      ],
      subtitles,
    };
  } catch (e) {
    logs.push(`extractVidtube error: ${e.message}`);
    return null;
  }
}

async function resolveStreams(linkId, audioLabel, logs = []) {
  const embedUrl = await resolveLinkId(linkId, logs);
  if (!embedUrl) return null;
  logs.push(`embedUrl for ${audioLabel}: ${embedUrl}`);

  if (/\/stream\/s-\d+\/\d+\/(sub|dub)/.test(embedUrl)) {
    return extractGetSources(embedUrl, audioLabel, logs);
  }
  if (embedUrl.includes("vidtube.site/stream/")) {
    return extractVidtube(embedUrl, audioLabel, logs);
  }
  if (embedUrl.includes(".m3u8") || embedUrl.includes(".mp4")) {
    return {
      streams: [
        {
          url: embedUrl,
          quality: audioLabel || "Auto",
          headers: { "User-Agent": UA, Referer: BASE_URL + "/" },
        },
      ],
      subtitles: [],
    };
  }
  logs.push(`embedUrl unrecognized pattern: ${embedUrl}`);
  return null;
}

async function fetchFreshEpMeta(slug, epNum, logs = []) {
  try {
    const html = await fetchText(`${BASE_URL}/watch/${slug}`);
    const $ = cheerio.load(html);
    let animeId = $("#watch-main").attr("data-id") || "";
    if (!animeId) {
      const m = html.match(/data-id="(\d+)"/);
      if (m) animeId = m[1];
    }
    if (!animeId) {
      logs.push(`fetchFreshEpMeta: animeId not found in /watch/${slug}`);
      return null;
    }

    const epRes = await timedFetch(`${BASE_URL}/ajax/episode/list/${animeId}?vrf=`, {
      headers: { ...AJAX_HEADERS, Referer: `${BASE_URL}/watch/${slug}` },
    });
    if (!epRes.ok) {
      logs.push(`fetchFreshEpMeta: episode list HTTP ${epRes.status}`);
      return null;
    }
    const epData = await epRes.json();
    if (!epData?.result) return null;

    const $ep = cheerio.load(epData.result);
    let meta = null;
    $ep("a[data-num]").each((_, el) => {
      if (meta) return;
      const $a = $ep(el);
      if ($a.attr("data-num") === epNum) {
        meta = {
          malId: $a.attr("data-mal") || "",
          timestamp: $a.attr("data-timestamp") || "",
          ids: $a.attr("data-ids") || "",
        };
      }
    });
    logs.push(`fetchFreshEpMeta: got fresh ids for ep ${epNum}: ${!!meta?.ids}`);
    return meta;
  } catch (e) {
    logs.push(`fetchFreshEpMeta error: ${e.message}`);
    return null;
  }
}

async function resolveEpisodeStream(paramUrl, preferredType = "sub", preferredServer = "", targetLinkId = "", logs = []) {
  let slug = "";
  let epNum = "1";
  let ids = "";

  if (paramUrl.includes("||")) {
    const parts = paramUrl.split("||");
    slug = parts[0] || "";
    epNum = parts[1] || "1";
    ids = parts[4] || "";
  } else {
    slug = extractSlug(paramUrl) || paramUrl;
    const epMatch = paramUrl.match(/\/ep-(\d+)/);
    if (epMatch) epNum = epMatch[1];
  }

  if (targetLinkId) {
    logs.push(`direct linkId resolution: ${targetLinkId}`);
    const audioLabel = preferredType === "dub" ? "Dub" : "Sub";
    const label = `${preferredServer || "Server"} [${audioLabel}]`;
    try {
      const resolved = await resolveStreams(targetLinkId, label, logs);
      if (resolved && resolved.streams?.length > 0) {
        let availableServers = { sub: [], dub: [] };
        if (ids) {
          try {
            availableServers = await fetchServerList(ids, logs);
          } catch (_) {}
        }
        return {
          streams: resolved.streams,
          subtitles: resolved.subtitles || [],
          server: preferredServer || "Server",
          type: preferredType,
          availableServers,
          epNum,
          slug,
        };
      }
    } catch (e) {
      logs.push(`direct linkId resolution error: ${e.message}, falling back to candidate list`);
    }
  }

  logs.push(`resolveEpisodeStream: slug=${slug}, epNum=${epNum}, prefType=${preferredType}, prefServer=${preferredServer}`);

  if (!slug) throw new Error("Could not determine anime slug from URL");

  // Refresh IDs to ensure they are not expired
  try {
    const freshMeta = await fetchFreshEpMeta(slug, epNum, logs);
    if (freshMeta?.ids) ids = freshMeta.ids;
  } catch (_) {}

  // If ids has spaces from URL decoding, restore '+'
  if (ids && ids.includes(" ")) {
    ids = ids.replace(/ /g, "+");
  }

  if (!ids) throw new Error(`Could not find server IDs for ${slug} Ep ${epNum}`);

  const { sub, dub } = await fetchServerList(ids, logs);

  // Build candidate order based on preferredType ('sub' or 'dub') and preferredServer
  const isDubPref = preferredType.toLowerCase() === "dub";
  let primaryList = isDubPref ? (dub.length > 0 ? dub : sub) : (sub.length > 0 ? sub : dub);
  let secondaryList = isDubPref ? sub : dub;

  if (preferredServer) {
    primaryList = [
      ...primaryList.filter((s) => s.name.toLowerCase() === preferredServer.toLowerCase()),
      ...primaryList.filter((s) => s.name.toLowerCase() !== preferredServer.toLowerCase()),
    ];
  }

  const candidates = [...primaryList, ...secondaryList];

  if (candidates.length === 0) {
    throw new Error(`No servers listed in server list for ${slug}. Logs: ${logs.join(" -> ")}`);
  }

  for (const server of candidates) {
    const isSub = sub.includes(server);
    const audioLabel = isSub ? "Sub" : "Dub";
    const label = `${server.name} [${audioLabel}]`;
    try {
      const resolved = await resolveStreams(server.linkId, label, logs);
      if (resolved && resolved.streams?.length > 0) {
        return {
          streams: resolved.streams,
          subtitles: resolved.subtitles || [],
          server: server.name,
          type: isSub ? "sub" : "dub",
          availableServers: { sub, dub },
          epNum,
          slug,
        };
      }
    } catch (e) {
      logs.push(`server ${server.name} error: ${e.message}`);
    }
  }

  throw new Error(`No working stream found. Trace: ${logs.join(" -> ")}`);
}

// ─── HLS Reverse Proxy ────────────────────────────────────────────────────────

function getUpstreamReferer(urlStr, explicitReferer) {
  if (explicitReferer && explicitReferer.startsWith("http")) {
    return explicitReferer;
  }
  const u = (urlStr || "").toLowerCase();
  if (
    u.includes("nexabloom") ||
    u.includes("midnightvoyage") ||
    u.includes("mysubsplay") ||
    u.includes("imgnex") ||
    u.includes("snapcdn") ||
    u.includes("megaplay")
  ) {
    return "https://megaplay.buzz/";
  }
  if (u.includes("vidtube") || u.includes("akirax") || u.includes("norami")) {
    return "https://vidtube.site/";
  }
  return "https://anikototv.bz/";
}

async function proxyHls(manifestUrl, workerOrigin, reqReferer) {
  const referer = getUpstreamReferer(manifestUrl, reqReferer);
  const res = await timedFetch(manifestUrl, {
    headers: { "User-Agent": UA, Referer: referer },
  });
  if (!res.ok) throw new Error(`Manifest fetch failed with HTTP ${res.status}`);

  const rawText = await res.text();
  const baseDir = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);

  const lines = rawText.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;

    let abs;
    try {
      abs = new URL(trimmed).href;
    } catch {
      abs = new URL(trimmed, baseDir).href;
    }

    if (trimmed.includes(".m3u8")) {
      return `${workerOrigin}/proxy/hls?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
    }
    return `${workerOrigin}/proxy/ts?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
  });

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

async function proxyTs(segmentUrl, reqReferer) {
  const referer = getUpstreamReferer(segmentUrl, reqReferer);
  const res = await timedFetch(
    segmentUrl,
    { headers: { "User-Agent": UA, Referer: referer } },
    30000
  );
  if (!res.ok) {
    return new Response(`Upstream TS error: ${res.status}`, {
      status: res.status,
      headers: CORS_HEADERS,
    });
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp2t",
      "Cache-Control": "public, max-age=3600",
      ...CORS_HEADERS,
    },
  });
}

async function proxySub(subUrl, reqReferer) {
  const referer = getUpstreamReferer(subUrl, reqReferer);
  const res = await timedFetch(
    subUrl,
    { headers: { "User-Agent": UA, Referer: referer } },
    15000
  );
  if (!res.ok) {
    return new Response(`Upstream Subtitle error: ${res.status}`, {
      status: res.status,
      headers: CORS_HEADERS,
    });
  }

  const vttText = await res.text();
  return new Response(vttText, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    },
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;
    const origin = `${url.protocol}//${url.host}`;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return errorResponse("Method not allowed", 405);
    }

    try {
      if (pathname === "/api/latest") {
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        return jsonResponse(await scrapeLatest(page));
      }

      if (pathname === "/api/popular") {
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        return jsonResponse(await scrapePopular(page));
      }

      if (pathname === "/api/search") {
        const q = searchParams.get("q") || "";
        if (!q.trim()) return errorResponse("Missing ?q=", 400);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        return jsonResponse(await scrapeSearch(q, page));
      }

      if (pathname === "/api/episodes") {
        const animeUrl = searchParams.get("url");
        if (!animeUrl) return errorResponse("Missing ?url=", 400);
        return jsonResponse(await scrapeEpisodes(animeUrl));
      }

      // Supports both /api/extract and /api/stream
      if (pathname === "/api/extract" || pathname === "/api/stream") {
        const targetUrl = searchParams.get("url") || searchParams.get("embedUrl");
        if (!targetUrl) return errorResponse("Missing ?url=", 400);

        const preferredType = searchParams.get("type") || "sub";
        const preferredServer = searchParams.get("server") || "";
        const targetLinkId = searchParams.get("linkId") || "";

        const logs = [];
        const result = await resolveEpisodeStream(targetUrl, preferredType, preferredServer, targetLinkId, logs);
        const primary = result.streams[0];
        const referer = primary.headers?.Referer || "https://megaplay.buzz/";
        const proxyUrl = `${origin}/proxy/hls?url=${encodeURIComponent(primary.url)}&referer=${encodeURIComponent(referer)}`;

        const subtitles = (result.subtitles || []).map((s) => ({
          ...s,
          proxyUrl: `${origin}/proxy/sub?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent(referer)}`,
        }));

        return jsonResponse({
          streamUrl: proxyUrl,
          rawStreamUrl: primary.url,
          quality: primary.quality,
          server: result.server,
          type: result.type,
          availableServers: result.availableServers || { sub: [], dub: [] },
          subtitles,
          streams: result.streams.map((s) => ({
            ...s,
            proxyUrl: `${origin}/proxy/hls?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent(s.headers?.Referer || referer)}`,
          })),
        });
      }

      if (pathname === "/api/servers") {
        const ids = searchParams.get("ids");
        const urlParam = searchParams.get("url");
        let serverIds = ids;
        if (!serverIds && urlParam && urlParam.includes("||")) {
          serverIds = urlParam.split("||")[4] || "";
        }
        if (!serverIds) return errorResponse("Missing ?ids= or ?url=", 400);
        return jsonResponse(await fetchServerList(serverIds));
      }

      if (pathname === "/api/debug") {
        const targetUrl = searchParams.get("url") || searchParams.get("embedUrl");
        if (!targetUrl) return errorResponse("Missing ?url=", 400);
        const preferredType = searchParams.get("type") || "sub";
        const preferredServer = searchParams.get("server") || "";
        const targetLinkId = searchParams.get("linkId") || "";
        const logs = [];
        try {
          const result = await resolveEpisodeStream(targetUrl, preferredType, preferredServer, targetLinkId, logs);
          return jsonResponse({ success: true, logs, result });
        } catch (e) {
          return jsonResponse({ success: false, logs, error: e.message }, 500);
        }
      }

      if (pathname === "/proxy/hls") {
        const mu = searchParams.get("url");
        if (!mu) return errorResponse("Missing ?url=", 400);
        const p = new URL(mu);
        if (!["http:", "https:"].includes(p.protocol)) return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxyHls(mu, origin, ref);
      }

      if (pathname === "/proxy/ts") {
        const su = searchParams.get("url");
        if (!su) return errorResponse("Missing ?url=", 400);
        const p = new URL(su);
        if (!["http:", "https:"].includes(p.protocol)) return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxyTs(su, ref);
      }

      if (pathname === "/proxy/sub") {
        const subUrl = searchParams.get("url");
        if (!subUrl) return errorResponse("Missing ?url=", 400);
        const p = new URL(subUrl);
        if (!["http:", "https:"].includes(p.protocol)) return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxySub(subUrl, ref);
      }

      return errorResponse(`Unknown route: ${pathname}`, 404);
    } catch (err) {
      console.error("[Worker Error]", err?.message, err?.stack);
      return errorResponse("Internal server error", 500, err?.message || "Unknown error");
    }
  },
};
