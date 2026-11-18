import { MProvider, Client } from "../runtime.js";
import * as cheerio from "cheerio";

const mangayomiSources = [
  {
    name: "WatchAnimeWorld",
    id: 1629482015,
    baseUrl: "https://watchanimeworld.one",
    lang: "hi",
    typeSource: "single",
    iconUrl: "https://watchanimeworld.one/wp-content/uploads/cropped-AW_Smiley-192x192.png",
    dateFormat: "",
    dateFormatLocale: "",
    isNsfw: false,
    hasCloudflare: false,
    sourceCodeUrl: "https://raw.githubusercontent.com/Mallyd11/mangayomi-anime-extensions/refs/heads/main/javascript/anime/src/all/watchanimeworld.js",
    apiUrl: "https://watchanimeworld.one",
    version: "1.0.0",
    isManga: false,
    itemType: 1,
    isFullData: false,
    appMinVerReq: "0.5.0",
    additionalParams: "",
    sourceCodeLanguage: 1,
    notes: "Watch Anime & Cartoons Online in Hindi, Tamil, Telugu, Malayalam, Bengali & English Dubbed/Subbed",
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
    return this.source?.baseUrl || "https://watchanimeworld.one";
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
      const list = [];
      const seen = new Set();

      if (page === 1) {
        // Fetch homepage which features top popular series and movies widgets
        const res = await this.client.get(this.baseUrl + "/", this.headers);
        if (res.statusCode === 200) {
          const $ = cheerio.load(res.body);

          // 1. Popular widget items
          $(".widget_top li").each((_, el) => {
            const a = $(el).find("a.item__card, a").first();
            let link = a.attr("href");
            if (!link || link.startsWith("#") || seen.has(link)) return;

            const imgEl = $(el).find("img").first();
            let name = $(el).find(".entry-title, .title, strong, h3").first().text().trim();
            if (!name) {
              const alt = imgEl.attr("alt") || "";
              name = alt.replace(/^Image\s+/i, "").trim();
            }
            if (!name) name = a.attr("title") || "";
            if (!name) return;

            seen.add(link);
            let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
            if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
            imageUrl = imageUrl.replace("/w185/", "/w500/");

            list.push({ name: cleanHtmlText(name), link, imageUrl });
          });

          // 2. Feed articles if list is sparse
          $("article.post").each((_, el) => {
            const a = $(el).find("a.lnk-blk, a").first();
            const link = a.attr("href");
            if (!link || seen.has(link)) return;

            const name =
              cleanHtmlText($(el).find(".entry-title, h2, h3").first().text()) ||
              cleanHtmlText(a.attr("title"));
            if (!name) return;

            seen.add(link);
            const imgEl = $(el).find("img").first();
            let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
            if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
            imageUrl = imageUrl.replace("/w185/", "/w500/");

            list.push({ name, link, imageUrl });
          });

          return { list, hasNextPage: true };
        }
      }

      // Page > 1 or fallback: use /series/page/N/
      const url =
        page === 1
          ? `${this.baseUrl}/series/`
          : `${this.baseUrl}/series/page/${page}/`;

      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const $ = cheerio.load(res.body);
      $("article.post").each((_, el) => {
        const a = $(el).find("a.lnk-blk, a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;

        const name =
          cleanHtmlText($(el).find(".entry-title, h2, h3").first().text()) ||
          cleanHtmlText(a.attr("title"));
        if (!name) return;

        seen.add(link);
        const imgEl = $(el).find("img").first();
        let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
        imageUrl = imageUrl.replace("/w185/", "/w500/");

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".nav-links .next, .pagination .next, a.next").length > 0 ||
        (list.length > 0 && page < 40);

      return { list, hasNextPage };
    } catch (e) {
      console.error("[WatchAnimeWorld.getPopular error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Latest Updated Anime ──────────────────────────────────────────────────

  async getLatestUpdates(page = 1) {
    try {
      const list = [];
      const seen = new Set();

      if (page === 1) {
        // Fetch homepage (90 latest anime, movies, and cartoons)
        const res = await this.client.get(this.baseUrl + "/", this.headers);
        if (res.statusCode === 200) {
          const $ = cheerio.load(res.body);

          $("article.post").each((_, el) => {
            const a = $(el).find("a.lnk-blk, a").first();
            const link = a.attr("href");
            if (!link || seen.has(link)) return;

            const name =
              cleanHtmlText($(el).find(".entry-title, h2, h3").first().text()) ||
              cleanHtmlText(a.attr("title"));
            if (!name) return;

            seen.add(link);
            const imgEl = $(el).find("img").first();
            let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
            if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
            imageUrl = imageUrl.replace("/w185/", "/w500/");

            list.push({ name, link, imageUrl });
          });

          return { list, hasNextPage: true };
        }
      }

      // Page > 1: fetch /series/page/N/
      const url = `${this.baseUrl}/series/page/${page}/`;
      const res = await this.client.get(url, this.headers);
      if (res.statusCode !== 200) return { list: [], hasNextPage: false };

      const $ = cheerio.load(res.body);
      $("article.post").each((_, el) => {
        const a = $(el).find("a.lnk-blk, a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;

        const name =
          cleanHtmlText($(el).find(".entry-title, h2, h3").first().text()) ||
          cleanHtmlText(a.attr("title"));
        if (!name) return;

        seen.add(link);
        const imgEl = $(el).find("img").first();
        let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
        imageUrl = imageUrl.replace("/w185/", "/w500/");

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".nav-links .next, .pagination .next, a.next").length > 0 ||
        (list.length > 0 && page < 40);

      return { list, hasNextPage };
    } catch (e) {
      console.error("[WatchAnimeWorld.getLatestUpdates error]:", e.message);
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

      $("article.post").each((_, el) => {
        const a = $(el).find("a.lnk-blk, a").first();
        const link = a.attr("href");
        if (!link || seen.has(link)) return;

        const name =
          cleanHtmlText($(el).find(".entry-title, h2, h3").first().text()) ||
          cleanHtmlText(a.attr("title"));
        if (!name) return;

        seen.add(link);
        const imgEl = $(el).find("img").first();
        let imageUrl = imgEl.attr("src") || imgEl.attr("data-src") || "";
        if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
        imageUrl = imageUrl.replace("/w185/", "/w500/");

        list.push({ name, link, imageUrl });
      });

      const hasNextPage =
        $(".nav-links .next, .pagination .next, a.next, a:contains('Next »')").length > 0;

      return { list, hasNextPage };
    } catch (e) {
      console.error("[WatchAnimeWorld.search error]:", e.message);
      return { list: [], hasNextPage: false };
    }
  }

  // ─── Anime Details & Episode List ──────────────────────────────────────────

  async getDetail(url) {
    try {
      const cleanUrl = url.split("?")[0].replace(/\/$/, "") + "/";
      const res = await this.client.get(cleanUrl, this.headers);
      if (res.statusCode !== 200) {
        return {
          name: "",
          description: "",
          imageUrl: "",
          genre: [],
          author: "WatchAnimeWorld",
          status: 0,
          episodes: [],
        };
      }

      const $ = cheerio.load(res.body);

      const title = cleanHtmlText(
        $("h1.entry-title, h1").first().text() ||
          $("meta[property='og:title']").attr("content")
      ).replace(/\s*-\s*Anime World.*$/i, "").replace(/\s*-\s*Watch Now.*$/i, "");

      const description = cleanHtmlText(
        $(".description p, .description, .entry-content, .sinopsis, meta[property='og:description']").first().text()
      );

      let imageUrl =
        $("img[src*='image.tmdb.org'], img.wp-post-image, article.single img, .post-thumbnail img").first().attr("src") ||
        $("meta[property='og:image']").attr("content") ||
        "";
      if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
      imageUrl = imageUrl.replace("/w185/", "/w500/");

      const genres = [];
      $("a[href*='/genre/'], a[href*='/genres/'], .genres a, .genre a").each((_, el) => {
        const g = cleanHtmlText($(el).text());
        if (g && !genres.includes(g)) genres.push(g);
      });

      const isCompleted = $("*:contains('Completed')").length > 0;
      const status = isCompleted ? 1 : 0;

      const episodes = [];
      const seenUrls = new Set();

      // Check if series with seasons dropdown
      const seasonLinks = $(".sel-temp a[data-season]");
      if (seasonLinks.length > 0) {
        const seasonData = [];
        seasonLinks.each((_, el) => {
          const season = $(el).attr("data-season");
          const post = $(el).attr("data-post");
          if (season && post && !seasonData.some((s) => s.season === season)) {
            seasonData.push({ season, post });
          }
        });

        seasonData.sort((a, b) => parseInt(a.season, 10) - parseInt(b.season, 10));

        const seasonFetches = seasonData.map(async ({ season, post }) => {
          const ajaxUrl = `${this.baseUrl}/wp-admin/admin-ajax.php?action=action_select_season&season=${season}&post=${post}`;
          const aRes = await this.client.get(ajaxUrl, this.headers);
          if (aRes.statusCode !== 200) return [];

          const $s = cheerio.load(aRes.body);
          const eps = [];
          $s("article.episodes, .episodes article, li").each((_, el) => {
            const link =
              $s(el).find("a.lnk-blk, a").first().attr("href") ||
              $s(el).find("a").attr("href");
            if (!link || !link.includes("/episode/") || seenUrls.has(link)) return;
            seenUrls.add(link);

            const num = cleanHtmlText($s(el).find(".num-epi").text());
            const epTitle = cleanHtmlText($s(el).find(".entry-title, .title").text()).replace(/^[0-9xX\s\-:]+/, "");
            const name = num
              ? `Season ${season} Episode ${num.split("x")[1] || num}${epTitle ? ": " + epTitle : ""}`
              : epTitle || `Season ${season} Episode`;

            eps.push({ name, url: link, dateUpload: null });
          });
          return eps;
        });

        const seasonResults = await Promise.all(seasonFetches);
        for (const r of seasonResults) episodes.push(...r);
      }

      // Fallback: direct episode links on page
      if (episodes.length === 0) {
        $("article.episodes, .episodes article, a[href*='/episode/']").each((_, el) => {
          const link = $(el).is("a")
            ? $(el).attr("href")
            : $(el).find("a.lnk-blk, a").first().attr("href");
          if (!link || !link.includes("/episode/") || seenUrls.has(link)) return;
          seenUrls.add(link);

          const num = cleanHtmlText($(el).find(".num-epi").text());
          const epTitle = cleanHtmlText($(el).find(".entry-title, .title").text()).replace(/^[0-9xX\s\-:]+/, "");
          const name = num
            ? `Episode ${num}${epTitle ? ": " + epTitle : ""}`
            : epTitle || cleanHtmlText($(el).text()) || "Episode";

          episodes.push({ name, url: link, dateUpload: null });
        });
      }

      // If still no episodes, and it is a movie or watch page
      if (
        episodes.length === 0 &&
        (cleanUrl.includes("/movies/") || $("iframe, section.player").length > 0)
      ) {
        episodes.push({
          name: title || "Full Movie",
          url: cleanUrl,
          dateUpload: null,
        });
      }

      return {
        name: title,
        description,
        imageUrl,
        genre: genres,
        author: "WatchAnimeWorld",
        status,
        episodes,
      };
    } catch (e) {
      console.error("[WatchAnimeWorld.getDetail error]:", e.message);
      return {
        name: "",
        description: "",
        imageUrl: "",
        genre: [],
        author: "WatchAnimeWorld",
        status: 0,
        episodes: [],
      };
    }
  }

  // ─── Stream Extractors ──────────────────────────────────────────────────────

  async extractZephyrix(embedUrl) {
    try {
      const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const id = idMatch[1];

      const apiUrl = `https://play.zephyrix.org/player/index.php?data=${id}&do=getVideo`;
      const postBody = `hash=${id}&r=${encodeURIComponent(this.baseUrl + "/")}`;
      const res = await this.client.post(
        apiUrl,
        {
          "User-Agent": DEFAULT_UA,
          Referer: `https://play.zephyrix.org/video/${id}`,
          "X-Requested-With": "XMLHttpRequest",
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        postBody
      );

      if (res.statusCode === 200) {
        const json = JSON.parse(res.body);
        const streamUrl = json.securedLink || json.videoSource;
        if (streamUrl) {
          return {
            url: streamUrl,
            headers: {
              Referer: "https://play.zephyrix.org/",
              "User-Agent": DEFAULT_UA,
            },
            subtitles: [],
          };
        }
      }
      return null;
    } catch (e) {
      console.warn("[WatchAnimeWorld.extractZephyrix error]:", e.message);
      return null;
    }
  }

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
      console.warn("[WatchAnimeWorld.extractNekomux error]:", e.message);
      return null;
    }
  }

  async extractRavok(embedUrl) {
    try {
      const idMatch = embedUrl.match(/\/video\/([a-zA-Z0-9]+)/);
      if (!idMatch) return null;
      const id = idMatch[1];

      const apiUrl = `https://ravok.buzz/player/index.php?data=${id}&do=getVideo`;
      const postBody = `hash=${id}&r=${encodeURIComponent(this.baseUrl + "/")}`;
      const res = await this.client.post(
        apiUrl,
        {
          "User-Agent": DEFAULT_UA,
          Referer: `https://ravok.buzz/video/${id}`,
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-Requested-With": "XMLHttpRequest",
        },
        postBody
      );

      if (res.statusCode === 200) {
        try {
          const json = JSON.parse(res.body);
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
      console.warn("[WatchAnimeWorld.extractRavok error]:", e.message);
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
      const seenIframeUrls = new Set();

      // 1. Check options tabs: a[href^="#options-"]
      $("a[href^='#options-']").each((_, el) => {
        const targetId = $(el).attr("href").replace(/^#/, "");
        const optContainer = $(`#${targetId}`);
        const iframe = optContainer.find("iframe").first();
        let src = iframe.attr("src") || iframe.attr("data-src");
        if (!src) return;
        if (src.startsWith("//")) src = "https:" + src;
        if (seenIframeUrls.has(src)) return;
        seenIframeUrls.add(src);

        const name = cleanHtmlText($(el).text()) || "Server";
        serverEntries.push({ name, iframeSrc: src });
      });

      // 2. Check all other iframes on the page
      $("iframe").each((_, el) => {
        let src = $(el).attr("src") || $(el).attr("data-src");
        if (!src) return;
        if (src.startsWith("//")) src = "https:" + src;
        if (seenIframeUrls.has(src)) return;
        seenIframeUrls.add(src);

        serverEntries.push({ name: "Default Server", iframeSrc: src });
      });

      const baseStreams = [];
      const seenBaseUrls = new Set();

      for (const entry of serverEntries) {
        let stream = null;
        const targetUrl = entry.iframeSrc;

        if (targetUrl.includes("play.zephyrix.org")) {
          stream = await this.extractZephyrix(targetUrl);
        } else if (targetUrl.includes("player.nekomux.com")) {
          stream = await this.extractNekomux(targetUrl);
        } else if (targetUrl.includes("ravok.buzz") || targetUrl.includes("as-cdn")) {
          stream = await this.extractRavok(targetUrl);
        } else if (targetUrl.includes(".m3u8")) {
          stream = {
            url: targetUrl,
            headers: { Referer: this.baseUrl + "/", "User-Agent": DEFAULT_UA },
            subtitles: [],
          };
        } else if (targetUrl.includes(".mp4")) {
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

      const streams = [];
      const seenQualities = new Set();

      for (const { entry, stream } of baseStreams) {
        let audioTracks = [];
        try {
          const mRes = await this.client.get(stream.url, stream.headers);
          if (mRes.statusCode === 200) {
            audioTracks = parseMasterAudioTracks(mRes.body);
          }
        } catch (e) {
          console.warn("[WatchAnimeWorld parseMasterAudioTracks error]:", e.message);
        }

        // Add each audio track as a distinct stream option with auto-selection
        for (const track of audioTracks) {
          const isSub = track.name === "Japanese" || track.name === "Original";
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

        // Master multi-audio option
        const multiName = `${entry.name || "Multi-Audio"} (Master)`;
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

      return streams;
    } catch (e) {
      console.error("[WatchAnimeWorld.getVideoList error]:", e.message);
      return [];
    }
  }
}

export { DefaultExtension, mangayomiSources };
