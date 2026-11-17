import { MProvider, Client } from "../runtime.js";
import * as cheerio from "cheerio";

const mangayomiSources = [
  {
    name: "AnimeSalt",
    id: 1748293012,
    baseUrl: "https://animesalt.ro",
    lang: "hi",
    typeSource: "single",
    iconUrl: "https://animesalt.ro/wp-content/uploads/2026/04/cropped-favicon-192x192.png",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl: "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/refs/heads/main/javascript/anime/src/all/animesalt.js",
    apiUrl: "https://animesalt.ro",
    version: "1.0.0",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Watch Anime Online in Hindi, English, Tamil, Telugu, Malayalam & Japanese Dubbed/Subbed",
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

function safeBase64Decode(str) {
  try {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(str, "base64").toString("utf-8");
    }
    return atob(str);
  } catch {
    return "";
  }
}

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get baseUrl() {
    return this.source?.baseUrl || "https://animesalt.ro";
  }

  get headers() {
    return {
      "User-Agent": DEFAULT_UA,
      Referer: this.baseUrl + "/",
      Accept: "application/json, text/html, */*",
    };
  }

  // ─── Popular Anime ─────────────────────────────────────────────────────────

  async getPopular(page = 1) {
    try {
      const url =
        page === 1
          ? `${this.baseUrl}/anime/?order=popular`
          : `${this.baseUrl}/anime/page/${page}/?order=popular`;

      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const $ = cheerio.load(res.body);
      const list = [];
      const seen = new Set();

      $(".bsx").each((_, el) => {
        const a = $(el).find("a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;
        seen.add(link);

        const name =
          cleanHtmlText($(el).find(".tt h2").text()) ||
          cleanHtmlText(a.attr("title")) ||
          cleanHtmlText($(el).find(".tt").text());
        const imageUrl =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          "";

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".pagination .next, .nav-links .next, a:contains('Next »')").length > 0;

      return { list, hasNextPage };
    } catch (e) {
      console.error("[AnimeSalt.getPopular error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Latest Updated Anime ──────────────────────────────────────────────────

  async getLatestUpdates(page = 1) {
    try {
      const url =
        page === 1
          ? `${this.baseUrl}/anime/?order=update`
          : `${this.baseUrl}/anime/page/${page}/?order=update`;

      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const $ = cheerio.load(res.body);
      const list = [];
      const seen = new Set();

      $(".bsx").each((_, el) => {
        const a = $(el).find("a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;
        seen.add(link);

        const name =
          cleanHtmlText($(el).find(".tt h2").text()) ||
          cleanHtmlText(a.attr("title")) ||
          cleanHtmlText($(el).find(".tt").text());
        const imageUrl =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          "";

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".pagination .next, .nav-links .next, a:contains('Next »')").length > 0;

      return { list, hasNextPage };
    } catch (e) {
      console.error("[AnimeSalt.getLatestUpdates error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  async search(query, page = 1) {
    try {
      const q = encodeURIComponent(query.trim());
      const url =
        page === 1
          ? `${this.baseUrl}/?s=${q}`
          : `${this.baseUrl}/page/${page}/?s=${q}`;

      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const $ = cheerio.load(res.body);
      const list = [];
      const seen = new Set();

      $(".bsx").each((_, el) => {
        const a = $(el).find("a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;
        seen.add(link);

        const name =
          cleanHtmlText($(el).find(".tt h2").text()) ||
          cleanHtmlText(a.attr("title")) ||
          cleanHtmlText($(el).find(".tt").text());
        const imageUrl =
          $(el).find("img").attr("src") ||
          $(el).find("img").attr("data-src") ||
          "";

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".pagination .next, .nav-links .next, a:contains('Next »')").length > 0;

      return { list, hasNextPage };
    } catch (e) {
      console.error("[AnimeSalt.search error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Anime Details & Episode List ──────────────────────────────────────────

  async getDetail(url) {
    try {
      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) {
        return {
          name: "",
          description: "",
          imageUrl: "",
          genre: [],
          author: "",
          status: 0,
          episodes: [],
        };
      }

      const $ = cheerio.load(res.body);

      const title = cleanHtmlText(
        $("h1.entry-title").first().text() ||
          $("meta[property='og:title']").attr("content") ||
          $("h1").first().text()
      ).replace(/ - Anime Salt.*$/i, "");

      const description = cleanHtmlText(
        $(".entry-content").first().text() ||
          $("meta[property='og:description']").attr("content")
      );

      const imageUrl =
        $("img.wp-post-image").first().attr("src") ||
        $("meta[property='og:image']").attr("content") ||
        "";

      const genres = [];
      $(".genxed a, a[rel='tag']").each((_, el) => {
        const g = cleanHtmlText($(el).text());
        if (g && !genres.includes(g)) genres.push(g);
      });

      const isCompleted =
        $("*:contains('Completed')").length > 0 ||
        $(".status, .spe").text().includes("Completed");
      const status = isCompleted ? 1 : 0;

      // Extract episodes from .asc-epcard
      const episodes = [];
      const seenUrls = new Set();

      $(".asc-epcard").each((_, el) => {
        const href = $(el).attr("href");
        if (!href || seenUrls.has(href)) return;
        seenUrls.add(href);

        const epNum = $(el).find(".asc-epnum").text().trim();
        const epTitle = cleanHtmlText($(el).find(".asc-eptitle").text());
        const name = epNum
          ? `Episode ${epNum}${epTitle ? ": " + epTitle : ""}`
          : epTitle || "Episode";

        episodes.push({
          name,
          url: href,
          dateUpload: null,
        });
      });

      // Fallback: search for any episode links on the page if .asc-epcard wasn't found
      if (episodes.length === 0) {
        $("a[href*='-1x'], a[href*='-episode-'], a[href*='-ep-']").each((_, el) => {
          const href = $(el).attr("href");
          if (!href || seenUrls.has(href)) return;
          seenUrls.add(href);
          const text = cleanHtmlText($(el).text());
          episodes.push({
            name: text || "Episode",
            url: href,
            dateUpload: null,
          });
        });
      }

      return {
        name: title,
        description,
        imageUrl,
        genre: genres,
        author: "AnimeSalt",
        status,
        episodes,
      };
    } catch (e) {
      console.error("[AnimeSalt.getDetail error]:", e.message);
      return {
        name: "",
        description: "",
        imageUrl: "",
        genre: [],
        author: "",
        status: 0,
        episodes: [],
      };
    }
  }

  // ─── Stream Extractors ──────────────────────────────────────────────────────

  async extractNekomux(embedUrl) {
    try {
      const match = embedUrl.match(/\/episode\/(\d+)/);
      if (!match) return null;
      const epId = match[1];

      const sourceApiUrl = `https://player.nekomux.com/episode/${epId}/source`;
      const res = await this.client.get(sourceApiUrl, {
        "User-Agent": DEFAULT_UA,
        Referer: `https://player.nekomux.com/episode/${epId}`,
        "X-Requested-With": "XMLHttpRequest",
      });

      if (res.statusCode === 200) {
        const json = JSON.parse(res.body);
        if (json.ok && json.url) {
          return {
            url: json.url,
            headers: {
              Referer: "https://player.nekomux.com/",
              "User-Agent": DEFAULT_UA,
            },
            subtitles: [],
          };
        }
      }
      return null;
    } catch (e) {
      console.warn("[AnimeSalt.extractNekomux error]:", e.message);
      return null;
    }
  }

  async extractRavok(embedUrl) {
    try {
      const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const id = idMatch[1];

      const apiUrl = `https://ravok.buzz/player/index.php?data=${id}&do=getVideo`;
      const body = new URLSearchParams({ hash: id, r: "https://animesalt.ro/" });
      const apiRes = await this.client.post(
        apiUrl,
        {
          "User-Agent": DEFAULT_UA,
          Referer: `https://ravok.buzz/video/${id}`,
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
      console.warn("[AnimeSalt.extractRavok error]:", e.message);
      return null;
    }
  }

  // ─── Video Stream List ──────────────────────────────────────────────────────

  async getVideoList(watchUrl) {
    try {
      const res = await this.client.get(watchUrl, this.headers);
      if (res.statusCode !== 200) return [];

      const $ = cheerio.load(res.body);
      const serverEntries = [];

      // Extract server buttons from .server-wrap
      $("button[onclick*='loadMi']").each((_, el) => {
        const onclick = $(el).attr("onclick") || "";
        const match = onclick.match(/loadMi\(\{\s*value:\s*['"]([^'"]+)['"]/);
        if (!match) return;

        const decoded = safeBase64Decode(match[1]);
        const srcMatch = decoded.match(/src=['"]([^'"]+)['"]/);
        if (!srcMatch) return;

        const iframeSrc = srcMatch[1]
          .replace(/&#038;/g, "&")
          .replace(/&amp;/g, "&");

        const sName =
          $(el).find(".server-button-title").text().trim() ||
          $(el).text().trim() ||
          "Server";

        const groupLabel = $(el)
          .closest(".server-group")
          .find("label")
          .text()
          .trim();
        const isDub = groupLabel.toLowerCase().includes("dub");

        serverEntries.push({
          name: sName,
          type: isDub ? "Dub" : "Sub",
          iframeSrc,
        });
      });

      // Fallback: check iframes directly on page
      if (serverEntries.length === 0) {
        $("iframe").each((_, el) => {
          const src = $(el).attr("src") || $(el).attr("data-src");
          if (src) {
            serverEntries.push({
              name: "Default",
              type: "Dub",
              iframeSrc: src,
            });
          }
        });
      }

      // Collect base extracted streams
      const baseStreams = [];
      const seenBaseUrls = new Set();

      for (const entry of serverEntries) {
        let stream = null;
        let targetUrl = entry.iframeSrc;

        try {
          const parsed = new URL(entry.iframeSrc);
          const innerUrl = parsed.searchParams.get("url");
          if (innerUrl) targetUrl = innerUrl;
        } catch {}

        if (targetUrl.includes("player.nekomux.com")) {
          stream = await this.extractNekomux(targetUrl);
        } else if (
          targetUrl.includes("as-cdn") ||
          targetUrl.includes("ravok.buzz")
        ) {
          stream = await this.extractRavok(targetUrl);
        } else if (targetUrl.includes(".m3u8")) {
          stream = {
            url: targetUrl,
            headers: { Referer: this.baseUrl + "/", "User-Agent": DEFAULT_UA },
            subtitles: [],
          };
        }

        if (stream && stream.url && !seenBaseUrls.has(stream.url)) {
          seenBaseUrls.add(stream.url);
          baseStreams.push({ entry, stream });
        }
      }

      // Parse master audio tracks helper
      function parseMasterAudioTracks(body) {
        const lines = body.split("\n");
        const tracks = [];
        const seen = new Set();
        for (const line of lines) {
          if (line.includes("#EXT-X-MEDIA:TYPE=AUDIO")) {
            const nameM = line.match(/NAME="([^"]+)"/);
            const langM = line.match(/LANGUAGE="([^"]+)"/);
            const rawName = nameM ? nameM[1] : "";
            const lang = (langM ? langM[1] : "").toLowerCase();

            let normalized = "Hindi";
            if (lang === "ta" || lang === "tam" || /tamil/i.test(rawName)) normalized = "Tamil";
            else if (lang === "te" || lang === "tel" || /telugu/i.test(rawName)) normalized = "Telugu";
            else if (lang === "ml" || lang === "mal" || /malayalam/i.test(rawName)) normalized = "Malayalam";
            else if (lang === "kn" || lang === "kan" || /kannada/i.test(rawName)) normalized = "Kannada";
            else if (lang === "bn" || lang === "ben" || /bengali/i.test(rawName)) normalized = "Bengali";
            else if (lang === "ja" || lang === "jpn" || /japan/i.test(rawName)) normalized = "Japanese";
            else if (lang === "en" || lang === "eng" || /english/i.test(rawName)) normalized = "English";
            else if (lang === "hi" || lang === "hin" || /original/i.test(rawName)) normalized = "Hindi";
            else normalized = rawName || "Audio";

            if (!seen.has(normalized)) {
              seen.add(normalized);
              tracks.push({
                name: normalized,
                rawName,
                lang: lang || normalized.toLowerCase().slice(0, 2),
              });
            }
          }
        }
        return tracks;
      }

      // Gather page language buttons
      const pageLangButtons = [];
      $("button[onclick*='loadMi']").each((_, el) => {
        const title =
          $(el).find(".server-button-title").text().trim() ||
          $(el).text().trim();
        if (
          title &&
          !title.toLowerCase().startsWith("multi") &&
          !title.toLowerCase().startsWith("abyss") &&
          title.length < 25
        ) {
          pageLangButtons.push(title);
        }
      });

      const streams = [];
      const seenQualities = new Set();

      // 1. Process audio tracks from each base stream
      for (const { entry, stream } of baseStreams) {
        let audioTracks = [];
        try {
          const mRes = await this.client.get(stream.url, stream.headers);
          if (mRes.statusCode === 200) {
            audioTracks = parseMasterAudioTracks(mRes.body);
          }
        } catch (e) {
          console.warn("[AnimeSalt parseMasterAudioTracks error]:", e.message);
        }

        const isNekomux = stream.url.includes("nekomux");
        const serverPrefix = isNekomux ? "Multi 1" : "Multi 2";

        // Add each language option as an explicit server
        for (const track of audioTracks) {
          const isSub = track.name === "Japanese";
          const type = isSub ? "Sub" : "Dub";
          const qualityName = `${track.name} (${type})`;

          if (!seenQualities.has(qualityName)) {
            seenQualities.add(qualityName);
            streams.push({
              url: `${stream.url}#audio=${encodeURIComponent(track.name)}`,
              originalUrl: entry.iframeSrc,
              quality: qualityName,
              headers: stream.headers,
              subtitles: stream.subtitles || [],
              audioLang: track.lang,
              audioName: track.name,
            });
          }
        }

        // Also add the multi-audio master server
        const multiName = `${entry.name || serverPrefix} (Multi-Audio)`;
        if (!seenQualities.has(multiName)) {
          seenQualities.add(multiName);
          streams.push({
            url: stream.url,
            originalUrl: entry.iframeSrc,
            quality: multiName,
            headers: stream.headers,
            subtitles: stream.subtitles || [],
          });
        }
      }

      // 2. Ensure every language button found on the page is accessible
      for (const pageLang of pageLangButtons) {
        let normalized = pageLang;
        if (/hindi/i.test(pageLang)) normalized = "Hindi";
        else if (/tamil/i.test(pageLang)) normalized = "Tamil";
        else if (/telugu/i.test(pageLang)) normalized = "Telugu";
        else if (/malayalam/i.test(pageLang)) normalized = "Malayalam";
        else if (/kannada/i.test(pageLang)) normalized = "Kannada";
        else if (/japanese/i.test(pageLang)) normalized = "Japanese";
        else if (/english/i.test(pageLang)) normalized = "English";

        const isSub = normalized === "Japanese";
        const type = isSub ? "Sub" : "Dub";
        const qualityName = `${normalized} (${type})`;

        if (!seenQualities.has(qualityName) && baseStreams.length > 0) {
          seenQualities.add(qualityName);
          const targetBase =
            normalized === "Japanese" ||
            normalized === "Telugu" ||
            normalized === "Kannada"
              ? baseStreams.find((b) => !b.stream.url.includes("nekomux")) ||
                baseStreams[0]
              : baseStreams.find((b) => b.stream.url.includes("nekomux")) ||
                baseStreams[0];

          streams.push({
            url: `${targetBase.stream.url}#audio=${encodeURIComponent(normalized)}`,
            originalUrl: targetBase.entry.iframeSrc,
            quality: qualityName,
            headers: targetBase.stream.headers,
            subtitles: targetBase.stream.subtitles || [],
            audioName: normalized,
          });
        }
      }

      // Fallback if no audio tracks or languages parsed
      if (streams.length === 0 && baseStreams.length > 0) {
        for (const { entry, stream } of baseStreams) {
          streams.push({
            url: stream.url,
            originalUrl: entry.iframeSrc,
            quality: `${entry.name} (${entry.type})`,
            headers: stream.headers,
            subtitles: stream.subtitles || [],
          });
        }
      }

      return streams;
    } catch (e) {
      console.error("[AnimeSalt.getVideoList error]:", e.message);
      return [];
    }
  }
}

export { mangayomiSources, DefaultExtension };
