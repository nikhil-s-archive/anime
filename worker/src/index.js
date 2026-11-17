/**
 * AnimeX — Multi-Platform Cloudflare Worker
 * Built on Mangayomi Anime Extensions ecosystem
 * Supports all platforms from anime_index.json
 *
 * Endpoints:
 *   GET /api/platforms            → List all available anime platforms
 *   GET /api/latest?platform=&page=  → Scrape latest updated anime
 *   GET /api/popular?platform=&page= → Scrape popular anime
 *   GET /api/search?q=&platform=&page= → Search anime by keyword
 *   GET /api/episodes?url=&platform= → Scrape anime details & episode list
 *   GET /api/extract?url=&platform=  → Extract streams & subtitles for an episode
 *   GET /api/stream?url=&platform=   → Alias for /api/extract
 *   GET /proxy/hls?url=&referer=     → Reverse proxy for HLS manifests
 *   GET /proxy/ts?url=&referer=      → Reverse proxy for video segments
 *   GET /proxy/sub?url=&referer=     → Reverse proxy for subtitle files
 */

import {
  getPlatforms,
  findPlatform,
  createPlatformExtension,
} from "./sources/index.js";

// ─── Headers & CORS ───────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With, Range",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
  "Access-Control-Max-Age": "86400",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

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

async function timedFetch(url, opts = {}, ms = 30000) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } catch (err) {
      lastErr = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    } finally {
      clearTimeout(id);
    }
  }
  throw lastErr;
}

function formatListResponse(result, page, platform) {
  const rawItems = result?.list || [];
  const items = rawItems.map((item) => {
    const title = (item.name || item.title || "").trim();
    const url = item.link || item.url || "";
    const thumbnail = item.imageUrl || item.thumbnail || item.poster || "";
    const episodeLabel = item.episodeLabel || null;

    return {
      title,
      name: title,
      url,
      link: url,
      thumbnail,
      imageUrl: thumbnail,
      episodeLabel,
      platform: platform.name,
      platformId: platform.id,
    };
  });

  return {
    page,
    hasNextPage: Boolean(result?.hasNextPage),
    items,
    total: items.length,
    platform: {
      id: platform.id,
      name: platform.name,
      iconUrl: platform.iconUrl,
      baseUrl: platform.baseUrl,
    },
  };
}

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
  if (u.includes("dramahot") || u.includes("zokoanime")) {
    return "https://zokoanime.video/";
  }
  if (u.includes("settlar.io")) {
    return "https://embed.settlar.io/";
  }
  if (u.includes("streamruby") || u.includes("nuvorel")) {
    return "https://nuvorel.top/";
  }
  if (u.includes("vmpx") || u.includes("vidmoly") || u.includes("vmget")) {
    return "https://vidmoly.org/";
  }
  if (
    u.includes("nekomux") ||
    u.includes("play.nekomux")
  ) {
    return "https://player.nekomux.com/";
  }
  if (
    u.includes("dramiyos") ||
    u.includes("acek-cdn") ||
    u.includes("morencius")
  ) {
    return "https://morencius.com/";
  }
  if (u.includes("desidubanime")) {
    return "https://www.desidubanime.me/";
  }
  if (
    u.includes("animeinfinity") ||
    u.includes("hindi-anime") ||
    u.includes("ravok") ||
    u.includes("animesalt") ||
    u.includes("as-cdn")
  ) {
    if (u.includes("as-cdn") || u.includes("ravok")) return "https://ravok.buzz/";
    if (u.includes("player.animeinfinity")) return "https://archive.animeinfinity.me/";
    if (u.includes("archive.animeinfinity")) return "https://cloud.hindi-anime.com/";
    if (u.includes("cloud.hindi-anime.com")) return "https://hindi-anime.com/";
    if (u.includes("animesalt")) return "https://animesalt.ro/";
    return "https://hindi-anime.com/";
  }
  return "https://anikototv.to/";
}

// ─── HLS Reverse Proxy ────────────────────────────────────────────────────────

async function proxyHls(manifestUrl, workerOrigin, reqReferer) {
  const cleanRef = (reqReferer || "").replace(/["']+$/, "").trim();
  const referer = getUpstreamReferer(manifestUrl, cleanRef);
  const res = await timedFetch(manifestUrl, {
    headers: { "User-Agent": UA, Referer: referer },
  });
  if (!res.ok) throw new Error(`Manifest fetch failed with HTTP ${res.status}`);

  const rawText = await res.text();
  const baseDir = manifestUrl.substring(0, manifestUrl.lastIndexOf("/") + 1);
  const isMaster = rawText.includes("#EXT-X-STREAM-INF");
  let nextIsVariant = false;

  const lines = rawText.split("\n").map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
        nextIsVariant = true;
      }
      // Handle sub-playlists or keys inside tags like #EXT-X-MEDIA:URI="..."
      if (trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
          let abs;
          try {
            abs = new URL(uri).href;
          } catch {
            abs = new URL(uri, baseDir).href;
          }
          const isMediaSub = trimmed.startsWith("#EXT-X-MEDIA");
          const endpoint = isMediaSub || abs.includes(".m3u8") ? "hls" : "ts";
          return `URI="${workerOrigin}/proxy/${endpoint}?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}"`;
        });
      }
      return line;
    }

    let abs;
    try {
      abs = new URL(trimmed).href;
    } catch {
      abs = new URL(trimmed, baseDir).href;
    }

    const isVariant = nextIsVariant || isMaster || trimmed.includes(".m3u8");
    nextIsVariant = false;

    const endpoint = isVariant ? "hls" : "ts";
    return `${workerOrigin}/proxy/${endpoint}?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer)}`;
  });

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "application/vnd.apple.mpegurl",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}

async function proxyTs(segmentUrl, reqReferer, clientRequest = null) {
  const cleanRef = (reqReferer || "").replace(/["']+$/, "").trim();
  const referer = getUpstreamReferer(segmentUrl, cleanRef);
  const headers = { "User-Agent": UA, Referer: referer };
  if (clientRequest) {
    const range = clientRequest.headers.get("Range");
    if (range) headers["Range"] = range;
  }

  const res = await timedFetch(segmentUrl, { headers }, 30000);
  if (!res.ok) {
    return new Response(`Upstream TS error: ${res.status}`, {
      status: res.status,
      headers: CORS_HEADERS,
    });
  }

  const rawType = res.headers.get("Content-Type") || "";
  let contentType = rawType;
  if (
    !rawType ||
    rawType.includes("javascript") ||
    rawType.includes("css") ||
    rawType.includes("image") ||
    rawType.includes("text/html")
  ) {
    contentType = segmentUrl.includes(".mkv")
      ? "video/x-matroska"
      : segmentUrl.includes(".mp4")
      ? "video/mp4"
      : "video/mp2t";
  }

  const responseHeaders = {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=3600",
    ...CORS_HEADERS,
  };
  if (res.headers.get("Content-Range")) {
    responseHeaders["Content-Range"] = res.headers.get("Content-Range");
  }
  if (res.headers.get("Accept-Ranges")) {
    responseHeaders["Accept-Ranges"] = res.headers.get("Accept-Ranges");
  }

  return new Response(res.body, {
    status: res.status,
    headers: responseHeaders,
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

  const vttText = toWebVtt(await res.text());
  return new Response(vttText, {
    status: 200,
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
      ...CORS_HEADERS,
    },
  });
}

function toWebVtt(text) {
  const normalized = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trimStart();
  if (/^WEBVTT(?:\s|$)/.test(normalized)) return normalized;
  return `WEBVTT\n\n${normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    "$1.$2"
  )}`;
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
      // ── GET /api/platforms ──
      if (pathname === "/api/platforms") {
        return jsonResponse({ platforms: getPlatforms() });
      }

      // ── GET /api/latest ──
      if (pathname === "/api/latest") {
        const platformKey =
          searchParams.get("platform") || searchParams.get("source") || "";
        const { ext, platform } = createPlatformExtension(platformKey);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

        let result;
        try {
          result = await ext.getLatestUpdates(page);
        } catch {
          result = await ext.getPopular(page);
        }
        return jsonResponse(formatListResponse(result, page, platform));
      }

      // ── GET /api/popular ──
      if (pathname === "/api/popular") {
        const platformKey =
          searchParams.get("platform") || searchParams.get("source") || "";
        const { ext, platform } = createPlatformExtension(platformKey);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

        const result = await ext.getPopular(page);
        return jsonResponse(formatListResponse(result, page, platform));
      }

      // ── GET /api/search ──
      if (pathname === "/api/search") {
        const q = searchParams.get("q") || "";
        if (!q.trim()) return errorResponse("Missing ?q=", 400);

        const platformKey =
          searchParams.get("platform") || searchParams.get("source") || "";
        const { ext, platform } = createPlatformExtension(platformKey);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));

        const result = await ext.search(q, page);
        return jsonResponse({
          query: q,
          ...formatListResponse(result, page, platform),
        });
      }

      // ── GET /api/episodes ──
      if (pathname === "/api/episodes") {
        const animeUrl = searchParams.get("url");
        if (!animeUrl) return errorResponse("Missing ?url=", 400);

        const platformKey =
          searchParams.get("platform") || searchParams.get("source") || "";
        const { ext, platform } = createPlatformExtension(platformKey);

        const detail = await ext.getDetail(animeUrl);
        const rawEpisodes = detail.episodes || detail.chapters || [];
        const episodes = rawEpisodes.map((ep, idx) => {
          const epName = (ep.name || "").trim();
          const match = epName.match(
            /\b(?:Episode|Ep\.?|E)?\s*(\d+(?:\.\d+)?)\b/i
          );
          const epNum = match ? match[1] : String(idx + 1);
          const titlePart = epName
            .replace(
              new RegExp("^(?:Episode|Ep\.?)\\s*" + epNum + "[:\\s-]*", "i"),
              ""
            )
            .trim();
          const label =
            epName || `Episode ${epNum}${titlePart ? ": " + titlePart : ""}`;

          const isDub =
            (ep.name && ep.name.toLowerCase().includes("dub")) ||
            (ep.url && ep.url.toLowerCase().includes("dub"));
          const isSub =
            (ep.name && ep.name.toLowerCase().includes("sub")) ||
            (ep.url && ep.url.toLowerCase().includes("sub"));
          const badge =
            ep.scanlator ||
            (isSub && isDub ? "Sub · Dub" : isDub ? "Dub" : isSub ? "Sub" : "");

          return {
            episode: epNum,
            label,
            badge,
            url: ep.url,
            dateUpload: ep.dateUpload || null,
          };
        });

        return jsonResponse({
          title: detail.name || detail.title || "",
          description: detail.description || detail.synopsis || "",
          thumbnail: detail.imageUrl || detail.thumbnail || detail.poster || "",
          genres: Array.isArray(detail.genre)
            ? detail.genre
            : detail.genres || [],
          author: detail.author || "",
          status: detail.status,
          totalEpisodes: episodes.length,
          episodes,
          platform: {
            id: platform.id,
            name: platform.name,
            iconUrl: platform.iconUrl,
            baseUrl: platform.baseUrl,
          },
        });
      }

      // ── GET /api/extract & /api/stream ──
      if (pathname === "/api/extract" || pathname === "/api/stream") {
        const targetUrl =
          searchParams.get("url") || searchParams.get("embedUrl");
        if (!targetUrl) return errorResponse("Missing ?url=", 400);

        const platformKey =
          searchParams.get("platform") || searchParams.get("source") || "";
        const { ext, platform } = createPlatformExtension(platformKey);

        const preferredType = (
          searchParams.get("type") || "sub"
        ).toLowerCase();
        const preferredServer = searchParams.get("server") || "";
        const targetLinkId = searchParams.get("linkId") || "";

        let rawStreams = [];
        try {
          rawStreams = (await ext.getVideoList(targetUrl)) || [];
        } catch (e) {
          console.error(`[getVideoList error on ${platform.name}]:`, e.message);
        }

        if (!rawStreams || rawStreams.length === 0) {
          throw new Error(`No streams found for episode on ${platform.name}`);
        }

        // Build server buckets for sub, dub, & all
        const sub = [];
        const dub = [];
        const all = [];
        const seenSubs = new Set();
        const seenDubs = new Set();
        const seenAll = new Set();

        for (const s of rawStreams) {
          const q = (s.quality || "").toLowerCase();
          const u = (s.url || "").toLowerCase();
          const isDub =
            q.includes("dub") ||
            q.includes("hindi") ||
            q.includes("tamil") ||
            q.includes("telugu") ||
            q.includes("malayalam") ||
            q.includes("bengali") ||
            q.includes("kannada") ||
            u.includes("/dub");
          const isSub =
            q.includes("sub") ||
            q.includes("jap") ||
            q.includes("eng") ||
            (!q.includes("dub") && !q.includes("hindi") && !q.includes("tamil") && !q.includes("telugu"));
          const isMulti =
            q.includes("multi") ||
            q.includes("dual") ||
            q.includes("all") ||
            q.includes("ravok") ||
            q.includes("nekomux") ||
            q.includes("infinity");
          const serverName = s.quality || "Server";
          const linkId = s.url;
          const srvObj = { name: serverName, linkId, quality: s.quality };

          if (!seenAll.has(serverName)) {
            seenAll.add(serverName);
            all.push(srvObj);
          }

          if (isDub || isMulti) {
            if (!seenDubs.has(serverName)) {
              seenDubs.add(serverName);
              dub.push(srvObj);
            }
          }
          if (isSub || isMulti) {
            if (!seenSubs.has(serverName)) {
              seenSubs.add(serverName);
              sub.push(srvObj);
            }
          }
        }

        // Guarantee all servers are accessible if one category is empty
        if (sub.length === 0) sub.push(...all);
        if (dub.length === 0) dub.push(...all);

        // Select primary stream matching user preference
        let primary = null;
        if (targetLinkId) {
          primary = rawStreams.find((s) => s.url === targetLinkId);
        }
        if (!primary && preferredServer) {
          primary = rawStreams.find(
            (s) =>
              (s.quality || "").toLowerCase() === preferredServer.toLowerCase()
          );
        }
        if (!primary) {
          const isDubPref = preferredType === "dub";
          let candidates = rawStreams.filter((s) => {
            const q = (s.quality || "").toLowerCase();
            const isDub =
              q.includes("dub") ||
              q.includes("hindi") ||
              q.includes("tamil") ||
              q.includes("telugu") ||
              q.includes("multi");
            return isDubPref ? isDub : !isDub;
          });
          if (candidates.length === 0) candidates = rawStreams;
          // Sort candidates so that playable HLS (.m3u8, Ravok, Nekomux) is chosen first
          candidates.sort((a, b) => {
            const aHls = (a.url || "").includes(".m3u8");
            const bHls = (b.url || "").includes(".m3u8");
            if (aHls && !bHls) return -1;
            if (!aHls && bHls) return 1;
            return 0;
          });
          primary = candidates[0] || rawStreams[0];
        }

        const referer =
          primary.headers?.Referer ||
          getUpstreamReferer(primary.url, primary.headers?.Referer);

        const isPrimaryHls = (primary.url || "").includes(".m3u8");
        const proxyEndpoint = isPrimaryHls ? "hls" : "ts";
        const proxyUrl = `${origin}/proxy/${proxyEndpoint}?url=${encodeURIComponent(
          primary.url
        )}&referer=${encodeURIComponent(referer)}`;

        // Collect and proxy subtitles
        const rawSubs = primary.subtitles?.length
          ? primary.subtitles
          : rawStreams.flatMap((s) => s.subtitles || []);
        const seenSubUrls = new Set();
        const subtitles = [];

        for (const s of rawSubs) {
          const subUrl = s.url || s.file;
          if (!subUrl || seenSubUrls.has(subUrl)) continue;
          seenSubUrls.add(subUrl);

          const remoteUrl = /^https?:\/\//i.test(subUrl);
          const subtitle = {
            url: subUrl,
            label: s.label || "Subtitle",
            lang:
              s.lang ||
              (subUrl.match(/_([a-z]{3})\.vtt/i) || [])[1] ||
              (s.label || "").toLowerCase().slice(0, 2) ||
              "en",
            default: Boolean(s.default),
          };
          if (remoteUrl) {
            subtitle.proxyUrl = `${origin}/proxy/sub?url=${encodeURIComponent(
              subUrl
            )}&referer=${encodeURIComponent(referer)}`;
          } else if (typeof subUrl === "string") {
            subtitle.content = toWebVtt(subUrl);
          }
          subtitles.push(subtitle);
        }

        const isPrimaryDub = (primary.quality || "")
          .toLowerCase()
          .includes("dub");

        return jsonResponse({
          streamUrl: proxyUrl,
          rawStreamUrl: primary.url,
          quality: primary.quality || "Auto",
          server: primary.quality || "Server",
          type: isPrimaryDub ? "dub" : "sub",
          availableServers: { sub, dub, all },
          subtitles,
          streams: rawStreams.map((s) => {
            const sRef = s.headers?.Referer || referer;
            const sHls = (s.url || "").includes(".m3u8");
            const sEndpoint = sHls ? "hls" : "ts";
            return {
              ...s,
              proxyUrl: `${origin}/proxy/${sEndpoint}?url=${encodeURIComponent(
                s.url
              )}&referer=${encodeURIComponent(sRef)}`,
            };
          }),
          platform: {
            id: platform.id,
            name: platform.name,
            iconUrl: platform.iconUrl,
            baseUrl: platform.baseUrl,
          },
        });
      }

      // ── Proxy endpoints ──
      if (pathname === "/proxy/hls") {
        const mu = searchParams.get("url");
        if (!mu) return errorResponse("Missing ?url=", 400);
        const p = new URL(mu);
        if (!["http:", "https:"].includes(p.protocol))
          return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxyHls(mu, origin, ref);
      }

      if (pathname === "/proxy/ts") {
        const su = searchParams.get("url");
        if (!su) return errorResponse("Missing ?url=", 400);
        const p = new URL(su);
        if (!["http:", "https:"].includes(p.protocol))
          return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxyTs(su, ref, request);
      }

      if (pathname === "/proxy/sub") {
        const subUrl = searchParams.get("url");
        if (!subUrl) return errorResponse("Missing ?url=", 400);
        const p = new URL(subUrl);
        if (!["http:", "https:"].includes(p.protocol))
          return errorResponse("Invalid protocol", 400);
        const ref = searchParams.get("referer") || "";
        return await proxySub(subUrl, ref);
      }

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
