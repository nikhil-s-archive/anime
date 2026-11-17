import { MProvider, Client, Document, SharedPreferences } from "../runtime.js";
import * as cheerio from "cheerio";

const mangayomiSources = [
  {
    name: "HindiAnime",
    id: 1948273615,
    baseUrl: "https://hindi-anime.com",
    lang: "hi",
    typeSource: "single",
    iconUrl: "https://hindi-anime.com/icon.svg",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl: "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/refs/heads/main/javascript/anime/src/all/hindianime.js",
    apiUrl: "https://hindi-anime.com/api",
    version: "1.0.0",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Hindi & regional dubbed anime streaming platform (Hindi, Tamil, Telugu, Malayalam)",
  },
];

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function cleanHtmlText(str) {
  return (str || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#038;/g, "&")
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function unpackDeanEdwards(packed) {
  try {
    const fn = new Function("return " + packed.replace(/^eval/, ""));
    return fn();
  } catch {
    return "";
  }
}

// In-memory cache for search-index.json
let cachedCatalog = null;
let catalogFetchTime = 0;
const CATALOG_CACHE_TTL = 3600 * 1000; // 1 hour

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get baseUrl() {
    return this.source?.baseUrl || "https://hindi-anime.com";
  }

  get apiUrl() {
    return this.source?.apiUrl || "https://hindi-anime.com/api";
  }

  get headers() {
    return {
      "User-Agent": DEFAULT_UA,
      Referer: this.baseUrl + "/",
      Accept: "application/json, text/html, */*",
    };
  }

  // ─── Search Index / Catalog Loader ──────────────────────────────────────────

  async loadCatalog() {
    const now = Date.now();
    if (cachedCatalog && now - catalogFetchTime < CATALOG_CACHE_TTL) {
      return cachedCatalog;
    }
    try {
      const res = await this.client.get(
        `${this.baseUrl}/search-index.json`,
        this.headers
      );
      if (res.statusCode === 200) {
        const data = JSON.parse(res.body);
        if (Array.isArray(data) && data.length > 0) {
          cachedCatalog = data;
          catalogFetchTime = now;
          return cachedCatalog;
        }
      }
    } catch (e) {
      console.warn("[HindiAnime.loadCatalog error]:", e.message);
    }
    return cachedCatalog || [];
  }

  // ─── Popular Anime ─────────────────────────────────────────────────────────

  async getPopular(page = 1) {
    try {
      if (page === 1) {
        const res = await this.client.get(
          `${this.apiUrl}/homepage`,
          this.headers
        );
        if (res.statusCode === 200) {
          const data = JSON.parse(res.body);
          const rawItems = data.popularItems || data.trendingItems || [];
          if (rawItems.length > 0) {
            const list = rawItems.map((item) => ({
              name: cleanHtmlText(item.title || item.name),
              link: `${this.baseUrl}/anime/${item.slug}`,
              imageUrl: item.poster || item.backdrop || "",
            }));
            return { list, hasNextPage: true };
          }
        }
      }

      // Sliced from full catalog
      const catalog = await this.loadCatalog();
      const perPage = 20;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageItems = catalog.slice(start, end);

      const list = pageItems.map((item) => ({
        name: cleanHtmlText(item.title),
        link: `${this.baseUrl}/anime/${item.slug}`,
        imageUrl: item.poster || item.backdrop || "",
      }));

      return {
        list,
        hasNextPage: end < catalog.length,
      };
    } catch (e) {
      console.error("[HindiAnime.getPopular error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Latest Updated Anime ──────────────────────────────────────────────────

  async getLatestUpdates(page = 1) {
    try {
      if (page === 1) {
        const res = await this.client.get(
          `${this.apiUrl}/homepage`,
          this.headers
        );
        if (res.statusCode === 200) {
          const data = JSON.parse(res.body);
          const rawItems = data.latestEpisodes || [];
          if (rawItems.length > 0) {
            const list = rawItems.map((item) => {
              const epNum = item.episodeNumber || item.episode;
              return {
                name: cleanHtmlText(item.animeTitle || item.title),
                link: `${this.baseUrl}/anime/${item.animeSlug || item.slug}`,
                imageUrl: item.animePoster || item.thumbnail || item.poster || "",
                episodeLabel: epNum ? `Episode ${epNum}` : null,
              };
            });
            return { list, hasNextPage: true };
          }
        }
      }

      // Sliced from catalog
      const catalog = await this.loadCatalog();
      const perPage = 20;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageItems = catalog.slice(start, end);

      const list = pageItems.map((item) => ({
        name: cleanHtmlText(item.title),
        link: `${this.baseUrl}/anime/${item.slug}`,
        imageUrl: item.poster || item.backdrop || "",
      }));

      return {
        list,
        hasNextPage: end < catalog.length,
      };
    } catch (e) {
      console.error("[HindiAnime.getLatestUpdates error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Search Anime ──────────────────────────────────────────────────────────

  async search(query = "", page = 1, filters = []) {
    try {
      const q = (query || "").trim().toLowerCase();
      const catalog = await this.loadCatalog();

      const matched = catalog.filter((item) => {
        if (!q) return true;
        const title = (item.title || "").toLowerCase();
        const slug = (item.slug || "").toLowerCase();
        const genres = Array.isArray(item.genres)
          ? item.genres.join(" ").toLowerCase()
          : "";
        return (
          title.includes(q) ||
          slug.includes(q) ||
          genres.includes(q)
        );
      });

      const perPage = 20;
      const start = (page - 1) * perPage;
      const end = start + perPage;
      const pageItems = matched.slice(start, end);

      const list = pageItems.map((item) => ({
        name: cleanHtmlText(item.title),
        link: `${this.baseUrl}/anime/${item.slug}`,
        imageUrl: item.poster || item.backdrop || "",
      }));

      return {
        list,
        hasNextPage: end < matched.length,
      };
    } catch (e) {
      console.error("[HindiAnime.search error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Anime Detail & Episode List ───────────────────────────────────────────

  async getDetail(url) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      // Handles /anime/:slug, /watch/:slug, or /watch/:slug/ep-...
      let slug = "";
      if (parts[0] === "anime" || parts[0] === "watch") {
        slug = parts[1] || "";
      } else {
        slug = parts[0] || "";
      }

      const catalog = await this.loadCatalog();
      const catalogItem = catalog.find((c) => c.slug === slug);

      // Fetch anime page HTML for up-to-date metadata and season listing
      let pageHtml = "";
      try {
        const res = await this.client.get(
          `${this.baseUrl}/anime/${slug}`,
          this.headers
        );
        if (res.statusCode === 200) {
          pageHtml = res.body;
        }
      } catch {}

      const $ = cheerio.load(pageHtml || "<html></html>");
      const title =
        cleanHtmlText($("h1").first().text()) ||
        catalogItem?.title ||
        slug.replace(/-/g, " ");

      const description =
        $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr("content") ||
        catalogItem?.synopsis ||
        "";

      const imageUrl =
        $('meta[property="og:image"]').attr("content") ||
        catalogItem?.poster ||
        "";

      const genres =
        catalogItem?.genres ||
        $(".badge, [class*='badge']")
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(Boolean);

      const status =
        catalogItem?.status === "Ongoing"
          ? 1
          : catalogItem?.status === "Completed"
          ? 0
          : 0;

      // Detect available seasons from HTML
      const seasonMatches = [...pageHtml.matchAll(/Season\s*(\d+)/gi)].map(
        (m) => parseInt(m[1], 10)
      );
      const seasonsFound = [...new Set(seasonMatches)].sort((a, b) => a - b);
      const seasonList =
        seasonsFound.length > 0
          ? seasonsFound
          : catalogItem?.seasons
          ? Array.from({ length: catalogItem.seasons }, (_, i) => i + 1)
          : [1];

      // Fetch episodes in parallel for all seasons
      const seasonResults = await Promise.all(
        seasonList.map(async (s) => {
          try {
            const epRes = await this.client.get(
              `${this.baseUrl}/api/anime-episodes?slug=${encodeURIComponent(slug)}&season=${s}`,
              this.headers
            );
            if (epRes.statusCode === 200) {
              const data = JSON.parse(epRes.body);
              if (Array.isArray(data.episodes) && data.episodes.length > 0) {
                return { season: s, episodes: data.episodes };
              }
            }
          } catch {}
          return { season: s, episodes: [] };
        })
      );

      const episodes = [];
      const multiSeason = seasonResults.filter((r) => r.episodes.length > 0).length > 1;

      for (const { season, episodes: epList } of seasonResults) {
        for (let i = 0; i < epList.length; i++) {
          const ep = epList[i];
          const epNum = parseInt(ep.season || ep.episode, 10) || i + 1;
          const cleanEpTitle = (ep.title || "").trim();
          const name = multiSeason
            ? `S${season} E${epNum}${cleanEpTitle ? ": " + cleanEpTitle : ""}`
            : `Episode ${epNum}${cleanEpTitle ? ": " + cleanEpTitle : ""}`;

          episodes.push({
            name,
            url: `${this.baseUrl}/watch/${slug}/ep-${season}-${epNum}`,
            dateUpload: null,
          });
        }
      }

      // If no episodic data found, check if it is a Movie
      if (episodes.length === 0) {
        episodes.push({
          name: "Full Movie",
          url: `${this.baseUrl}/watch/${slug}`,
          dateUpload: null,
        });
      }

      return {
        name: title,
        description,
        imageUrl,
        genre: genres,
        author: catalogItem?.studio || "HindiAnime",
        status,
        episodes,
      };
    } catch (e) {
      console.error("[HindiAnime.getDetail error]:", e.message);
      return {
        name: "",
        description: "",
        imageUrl: "",
        genre: [],
        author: "HindiAnime",
        status: 0,
        episodes: [],
      };
    }
  }

  // ─── Video Stream Extraction ───────────────────────────────────────────────

  parseWatchUrl(urlStr) {
    try {
      const u = new URL(urlStr);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] !== "watch") return null;
      const slug = parts[1];
      const epPart = parts[2] || "";
      const epMatch = epPart.match(/ep-(\d+)-(\d+)/);
      if (epMatch) {
        return {
          slug,
          season: epMatch[1],
          ep: epMatch[2],
          isMovie: false,
        };
      }
      return {
        slug,
        season: "1",
        ep: "1",
        isMovie: true,
      };
    } catch {
      return null;
    }
  }

  async extractPlayZen(embedUrl) {
    try {
      const res = await this.client.get(embedUrl, {
        "User-Agent": DEFAULT_UA,
        Referer: this.baseUrl + "/",
      });
      if (res.statusCode !== 200) return null;
      const html = res.body;

      const directMatch = html.match(/directUrl\s*=\s*["']([^"']+)["']/);
      const primaryMatch = html.match(/primaryUrl\s*=\s*["']([^"']+)["']/);
      const fallbackMatch = html.match(/fallbackUrl\s*=\s*["']([^"']+)["']/);

      const direct = (
        directMatch ? directMatch[1] : primaryMatch ? primaryMatch[1] : fallbackMatch ? fallbackMatch[1] : ""
      ).replace(/\\\//g, "/");

      if (!direct) return null;

      const vtts = (html.match(/https?:\/\/[^\s"'`]+\.vtt[^\s"'`]*/g) || []).map((v) => ({
        url: v,
        lang: "en",
      }));

      return {
        url: direct,
        headers: {
          Referer: "https://archive.animeinfinity.me/",
          "User-Agent": DEFAULT_UA,
        },
        subtitles: vtts,
      };
    } catch (e) {
      console.warn("[HindiAnime.extractPlayZen error]:", e.message);
      return null;
    }
  }

  async extractRavok(embedUrl) {
    try {
      const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const id = idMatch[1];

      // Call ravok getVideo API to obtain the master HLS stream directly
      const apiUrl = `https://ravok.buzz/player/index.php?data=${id}&do=getVideo`;
      const body = new URLSearchParams({ hash: id, r: this.baseUrl + "/" });
      const apiRes = await this.client.post(
        apiUrl,
        {
          "User-Agent": DEFAULT_UA,
          Referer: embedUrl,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        body.toString()
      );

      if (apiRes.statusCode === 200) {
        try {
          const json = JSON.parse(apiRes.body);
          const streamUrl = json.videoSource || json.securedLink;
          if (streamUrl) {
            return {
              url: streamUrl,
              headers: {
                Referer: "https://ravok.buzz/",
                "User-Agent": DEFAULT_UA,
              },
              subtitles: [],
            };
          }
        } catch {}
      }

      return null;
    } catch (e) {
      console.warn("[HindiAnime.extractRavok error]:", e.message);
      return null;
    }
  }

  async getVideoList(watchUrl) {
    try {
      const parsed = this.parseWatchUrl(watchUrl);
      if (!parsed) return [];
      const { slug, season, ep, isMovie } = parsed;

      const endpoints = [
        `https://cloud.hindi-anime.com/sources?id=${encodeURIComponent(slug)}&season=${season}&ep=${ep}&movie=${isMovie ? 1 : 0}`,
        `${this.apiUrl}/stream-proxy?id=${encodeURIComponent(slug)}&season=${season}&ep=${ep}${isMovie ? "&movie=1" : ""}`,
      ];

      // Merge results from both endpoints to show all available servers
      const allServerResults = [];
      const seenEmbeds = new Set();

      for (const epUrl of endpoints) {
        try {
          const res = await this.client.get(epUrl, {
            "User-Agent": DEFAULT_UA,
            Referer: this.baseUrl + "/",
          });
          if (res.statusCode === 200) {
            const data = JSON.parse(res.body);
            if (Array.isArray(data.results)) {
              for (const r of data.results) {
                const key = r.embed || r.url || r.fileId || "";
                if (key && !seenEmbeds.has(key)) {
                  seenEmbeds.add(key);
                  allServerResults.push(r);
                }
              }
            }
          }
        } catch {}
      }

      // Concurrently extract all servers
      const streamPromises = allServerResults.map(async (server) => {
        const embed = server.embed || server.url;
        if (!embed) return null;

        let stream = null;
        if (embed.includes("ravok.buzz")) {
          stream = await this.extractRavok(embed);
        } else if (embed.includes("archive.animeinfinity.me")) {
          stream = await this.extractPlayZen(embed);
        } else if (embed.includes(".m3u8")) {
          stream = {
            url: embed,
            headers: { Referer: this.baseUrl + "/", "User-Agent": DEFAULT_UA },
            subtitles: [],
          };
        } else if (
          (server.fileId && server.source === "GoogleDrive") ||
          (embed && embed.includes("drive.google.com"))
        ) {
          const fileId =
            server.fileId ||
            (embed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || [])[1] ||
            (embed.match(/[?&]id=([a-zA-Z0-9_-]+)/) || [])[1];
          if (fileId) {
            stream = {
              url: `https://drive.google.com/uc?id=${fileId}&export=download`,
              headers: { "User-Agent": DEFAULT_UA },
              subtitles: [],
            };
          }
        }

        if (stream && stream.url) {
          const lang = server.languageLabel || server.audioLanguage || "Hindi";
          const sName = server.label || server.server || "Server";
          const provider =
            server.source ||
            server.sourceProvider ||
            (embed.includes("ravok")
              ? "Ravok"
              : embed.includes("animeinfinity")
              ? "PlayZen"
              : "");
          const displayName =
            provider && !sName.toLowerCase().includes(provider.toLowerCase())
              ? `${sName} · ${provider} (${lang})`
              : `${sName} (${lang})`;

          return {
            url: stream.url,
            originalUrl: embed,
            quality: displayName,
            headers: stream.headers,
            subtitles: stream.subtitles || [],
          };
        }
        return null;
      });

      const resolved = await Promise.all(streamPromises);
      const streams = resolved.filter(Boolean);

      // Prioritize browser-compatible HLS (.m3u8) streams first so video plays instantly
      streams.sort((a, b) => {
        const aHls = (a.url || "").includes(".m3u8");
        const bHls = (b.url || "").includes(".m3u8");
        if (aHls && !bHls) return -1;
        if (!aHls && bHls) return 1;
        return 0;
      });

      return streams;
    } catch (e) {
      console.error("[HindiAnime.getVideoList error]:", e.message);
      return [];
    }
  }
}

export { mangayomiSources, DefaultExtension };
