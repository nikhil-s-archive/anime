import { MProvider, Client, Document, SharedPreferences } from "../runtime.js";
import * as cheerio from "cheerio";

const mangayomiSources = [
  {
    name: "DesiDubAnime",
    id: 1827465920,
    baseUrl: "https://www.desidubanime.me",
    lang: "hi",
    typeSource: "single",
    iconUrl: "https://www.desidubanime.me/wp-content/uploads/2025/01/Logoo.png",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl: "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/refs/heads/main/javascript/anime/src/all/desidubanime.js",
    apiUrl: "https://www.desidubanime.me/wp-json",
    version: "1.0.0",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Indian regional dubbed anime streaming platform (Hindi, Tamil, Telugu, Malayalam, Bengali, etc.)",
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

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
  }

  get baseUrl() {
    return this.source?.baseUrl || "https://www.desidubanime.me";
  }

  get apiUrl() {
    return this.source?.apiUrl || "https://www.desidubanime.me/wp-json";
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
      const url = `${this.apiUrl}/wp/v2/anime?page=${page}&per_page=20&_embed=true`;
      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const totalPages = parseInt(res.headers["x-wp-totalpages"] || "1", 10);
      const data = JSON.parse(res.body);
      const list = data.map((item) => ({
        name: cleanHtmlText(item.title?.rendered),
        link: item.link,
        imageUrl: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "",
      }));

      return { list, hasNextPage: page < totalPages };
    } catch (e) {
      console.error("[DesiDubAnime.getPopular error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Latest Updated Anime ──────────────────────────────────────────────────

  async getLatestUpdates(page = 1) {
    try {
      const url = `${this.apiUrl}/wp/v2/anime?page=${page}&per_page=20&orderby=modified&order=desc&_embed=true`;
      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const totalPages = parseInt(res.headers["x-wp-totalpages"] || "1", 10);
      const data = JSON.parse(res.body);
      const list = data.map((item) => ({
        name: cleanHtmlText(item.title?.rendered),
        link: item.link,
        imageUrl: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "",
      }));

      return { list, hasNextPage: page < totalPages };
    } catch (e) {
      console.error("[DesiDubAnime.getLatestUpdates error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Search ────────────────────────────────────────────────────────────────

  async search(query, page = 1) {
    try {
      const q = encodeURIComponent(query.trim());
      const wpUrl = `${this.apiUrl}/wp/v2/anime?search=${q}&page=${page}&per_page=20&_embed=true`;

      if (page === 1) {
        const kiraUrl = `${this.apiUrl}/kiranime/v1/anime/search?query=${q}`;
        const [wpRes, kiraRes] = await Promise.all([
          this.client.get(wpUrl, this.headers).catch(() => null),
          this.client.get(kiraUrl, this.headers).catch(() => null),
        ]);

        const itemsMap = new Map();

        // 1. Kiranime search provides alias & english matching
        if (kiraRes && kiraRes.statusCode === 200) {
          try {
            const data = JSON.parse(kiraRes.body);
            const $k = cheerio.load(data.result || "");
            $k("a").each((_, el) => {
              const link = $k(el).attr("href");
              const name = cleanHtmlText($k(el).find("h3").first().text());
              const imageUrl = $k(el).find("img").first().attr("src") || "";
              if (link && name && !itemsMap.has(link)) {
                itemsMap.set(link, { name, link, imageUrl });
              }
            });
          } catch {}
        }

        // 2. WordPress REST API results
        let hasNextPage = false;
        if (wpRes && wpRes.statusCode === 200) {
          try {
            const totalPages = parseInt(
              wpRes.headers["x-wp-totalpages"] || "1",
              10
            );
            hasNextPage = page < totalPages;
            const data = JSON.parse(wpRes.body);
            for (const item of data) {
              const link = item.link;
              if (link && !itemsMap.has(link)) {
                itemsMap.set(link, {
                  name: cleanHtmlText(item.title?.rendered),
                  link,
                  imageUrl:
                    item._embedded?.["wp:featuredmedia"]?.[0]?.source_url ||
                    "",
                });
              }
            }
          } catch {}
        }

        return { list: Array.from(itemsMap.values()), hasNextPage };
      }

      // Subsequent pages use standard WP pagination
      const wpRes = await this.client.get(wpUrl, this.headers);
      if (wpRes.statusCode !== 200) return { list: [], hasNextPage: false };
      const totalPages = parseInt(
        wpRes.headers["x-wp-totalpages"] || "1",
        10
      );
      const data = JSON.parse(wpRes.body);
      const list = data.map((item) => ({
        name: cleanHtmlText(item.title?.rendered),
        link: item.link,
        imageUrl: item._embedded?.["wp:featuredmedia"]?.[0]?.source_url || "",
      }));

      return { list, hasNextPage: page < totalPages };
    } catch (e) {
      console.error("[DesiDubAnime.search error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Anime Details & Episode List ──────────────────────────────────────────

  async getDetail(url) {
    try {
      const cleanUrl = url.split("?")[0].replace(/\/$/, "") + "/";
      const isWatchPage = cleanUrl.includes("/watch/");

      let animeHtml = "";
      let watchUrl = "";

      if (isWatchPage) {
        watchUrl = cleanUrl;
        const res = await this.client.get(watchUrl, this.headers);
        animeHtml = res.body;
      } else {
        const res = await this.client.get(cleanUrl, this.headers);
        animeHtml = res.body;
      }

      const $ = cheerio.load(animeHtml);

      const title = cleanHtmlText(
        $("meta[property='og:title']").attr("content") ||
          $("h1").first().text()
      )
        .replace(/ - Desi Dub Anime.*$/i, "")
        .trim();

      const description = cleanHtmlText(
        $("meta[property='og:description']").attr("content") ||
          $(".synopsis, .description, .entry-content, [itemprop='description']").first().text()
      );

      const imageUrl =
        $("meta[property='og:image']").attr("content") ||
        $(".anime-main-image, img.aspect-").first().attr("src") ||
        "";

      const genres = [];
      $("a[href*='/genre/'], a[href*='/tag/']").each((_, el) => {
        const g = cleanHtmlText($(el).text());
        if (g && !genres.includes(g)) genres.push(g);
      });

      const isCompleted = $("*:contains('Completed')").length > 0;
      const status = isCompleted ? 1 : 0;

      // Locate episode list
      const episodes = [];

      if (!isWatchPage) {
        watchUrl =
          $("a:contains('Watch Now')").first().attr("href") ||
          $("a[href*='/watch/']").first().attr("href") ||
          "";
      }

      if (watchUrl) {
        let watchHtml = isWatchPage ? animeHtml : "";
        if (!watchHtml) {
          try {
            const wRes = await this.client.get(watchUrl, this.headers);
            if (wRes.statusCode === 200) watchHtml = wRes.body;
          } catch {}
        }

        if (watchHtml) {
          const $w = cheerio.load(watchHtml);
          const epLinks = $w(
            ".episode-list-display-box a, .episode-list a[href*='/watch/'], a[href*='/watch/']"
          );

          const seenEp = new Set();
          epLinks.each((_, el) => {
            let href = $w(el).attr("href");
            if (!href) return;
            if (href.startsWith("/")) {
              href = this.baseUrl + href;
            }
            if (!href.startsWith(`${this.baseUrl}/watch/`) || seenEp.has(href)) {
              return;
            }
            seenEp.add(href);

            const rawText = cleanHtmlText($w(el).text());
            const epMatch =
              href.match(/episode-(\d+(?:\.\d+)?)/i) ||
              rawText.match(/\b(?:Episode|Ep\.?|E)?\s*(\d+(?:\.\d+)?)\b/i);
            const num = epMatch ? epMatch[1] : "";
            const cleanTitle = rawText.replace(/^\d+\s*/, "").trim();

            const name = num
              ? `Episode ${num}${cleanTitle ? ": " + cleanTitle : ""}`
              : rawText || "Episode";

            episodes.push({
              name,
              url: href,
              dateUpload: null,
            });
          });
        }
      }

      // Fallback: direct episode links on anime page
      if (episodes.length === 0) {
        $("a[href*='/watch/']").each((_, el) => {
          let href = $(el).attr("href");
          if (!href) return;
          if (href.startsWith("/")) href = this.baseUrl + href;
          if (!href.startsWith(`${this.baseUrl}/watch/`)) return;
          const text = cleanHtmlText($(el).text());
          episodes.push({
            name: text || "Episode",
            url: href,
            dateUpload: null,
          });
        });
      }

      // Sort episodes ascending by episode number
      episodes.sort((a, b) => {
        const numA = parseFloat(
          (a.name.match(/\b(?:Episode|Ep\.?|E)?\s*(\d+(?:\.\d+)?)\b/i) || [])[1] ||
            (a.url.match(/episode-(\d+(?:\.\d+)?)/i) || [])[1] ||
            0
        );
        const numB = parseFloat(
          (b.name.match(/\b(?:Episode|Ep\.?|E)?\s*(\d+(?:\.\d+)?)\b/i) || [])[1] ||
            (b.url.match(/episode-(\d+(?:\.\d+)?)/i) || [])[1] ||
            0
        );
        return numA - numB;
      });

      return {
        name: title,
        description,
        imageUrl,
        genre: genres,
        author: "DesiDubAnime",
        status,
        episodes,
      };
    } catch (e) {
      console.error("[DesiDubAnime.getDetail error]:", e.message);
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

  // ─── Video Stream Extractor ────────────────────────────────────────────────

  async extractEmbedStream(embedUrl) {
    try {
      const res = await this.client.get(embedUrl, {
        "User-Agent": DEFAULT_UA,
        Referer: this.baseUrl + "/",
      });
      if (res.statusCode !== 200) return null;
      const html = res.body;

      // 1. Direct master or stream .m3u8 link in HTML
      const m3u8Matches = html.match(/https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*/g);
      if (m3u8Matches && m3u8Matches.length > 0) {
        const vtts = html.match(/https?:\/\/[^\s"'`]+\.vtt[^\s"'`]*/g) || [];
        return {
          url: m3u8Matches[0],
          headers: { Referer: embedUrl, "User-Agent": DEFAULT_UA },
          subtitles: vtts.map((v) => ({ url: v, lang: "en" })),
        };
      }

      // 2. Dean Edwards Packed JavaScript (used by EVids, Morencius, etc.)
      const packedMatch = html.match(
        /eval\(function\(p,a,c,k,e,d\)[\s\S]+?\.split\(['"]\|['"]\)\)\)/
      );
      if (packedMatch) {
        const unpacked = unpackDeanEdwards(packedMatch[0]);
        if (unpacked) {
          const unpackedM3u8 =
            unpacked.match(/https?:\/\/[^\s"'`]+\.m3u8[^\s"'`]*/g) || [];
          if (unpackedM3u8.length > 0) {
            const vtts =
              unpacked.match(/https?:\/\/[^\s"'`]+\.vtt[^\s"'`]*/g) || [];
            return {
              url: unpackedM3u8[0],
              headers: { Referer: embedUrl, "User-Agent": DEFAULT_UA },
              subtitles: vtts.map((v) => ({ url: v, lang: "en" })),
            };
          }
        }
      }

      // 3. Direct .mp4 video link in HTML
      const mp4Matches = html.match(/https?:\/\/[^\s"'`]+\.mp4[^\s"'`]*/g);
      if (mp4Matches && mp4Matches.length > 0) {
        return {
          url: mp4Matches[0],
          headers: { Referer: embedUrl, "User-Agent": DEFAULT_UA },
        };
      }

      return null;
    } catch {
      return null;
    }
  }

  async getVideoList(watchUrl) {
    try {
      const res = await this.client.get(watchUrl, { "User-Agent": DEFAULT_UA });
      if (res.statusCode !== 200) return [];
      const html = res.body;
      const $ = cheerio.load(html);

      const embedItems = [];
      $("[data-embed-id]").each((_, el) => {
        const rawId = $(el).attr("data-embed-id");
        if (!rawId || !rawId.includes(":")) return;
        const parts = rawId.split(":");
        try {
          const rawName = Buffer.from(parts[0], "base64").toString("utf-8");
          const embedUrl = Buffer.from(parts[1], "base64").toString("utf-8");
          const isSub = rawName.toLowerCase().includes("sub");
          const isDub = rawName.toLowerCase().includes("dub");
          const type = isSub && !isDub ? "Sub" : "Dub";
          const serverLabel =
            $(el).text().trim() || rawName.replace(/sub|dub/gi, "");
          embedItems.push({
            name: serverLabel,
            type,
            embedUrl,
          });
        } catch {}
      });

      if (embedItems.length === 0) {
        const iframe = $("iframe").attr("src");
        if (iframe) {
          embedItems.push({ name: "Default", type: "Dub", embedUrl: iframe });
        }
      }

      const streams = [];
      for (const item of embedItems) {
        const extracted = await this.extractEmbedStream(item.embedUrl);
        if (extracted) {
          streams.push({
            url: extracted.url,
            originalUrl: item.embedUrl,
            quality: `${item.name} (${item.type})`,
            headers: extracted.headers,
            subtitles: extracted.subtitles || [],
          });
        }
      }

      return streams;
    } catch (e) {
      console.error("[DesiDubAnime.getVideoList error]:", e.message);
      return [];
    }
  }
}

export { mangayomiSources, DefaultExtension };
