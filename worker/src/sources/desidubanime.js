// DesiDubAnime (https://www.desidubanime.me) — Mangayomi extension.
//
// Standalone Mangayomi build: no import line. To run it inside the worker
// (worker/src/sources/), prepend:
//   import { MProvider, Client, Document, SharedPreferences } from "../runtime.js";

const mangayomiSources = [
  {
    "name": "DesiDubAnime",
    "id": 482917356,
    "lang": "hi",
    "baseUrl": "https://www.desidubanime.me",
    "apiUrl": "",
    "iconUrl": "https://www.desidubanime.me/wp-content/uploads/2025/01/cropped-LogoM-270x270.png",
    "typeSource": "single",
    "itemType": 1,
    "version": "0.0.1",
    "pkgPath": "anime/src/hi/desidubanime.js",
    "isManga": false,
    "isNsfw": false,
    "hasCloudflare": false,
    "isFullData": false,
    "appMinVerReq": "0.5.0",
    "sourceCodeUrl": "https://raw.githubusercontent.com/nikhil-s-archive/anime/refs/heads/main/javascript/anime/src/hi/desidubanime.js",
    "dateFormat": "",
    "dateFormatLocale": "",
    "additionalParams": "",
    "sourceCodeLanguage": 1,
    "notes": "",
  },
];

// ---------------------------------------------------------------- tunables
// If a list page comes back empty, the card container class is the first
// thing to adjust: add the real one to the FRONT of this list.
var CARD_SELECTORS = ["article", ".kira-anime", ".anime-card", ".film_list-wrap .flw-item", ".item"];

// Attributes a server/mirror button might carry its embed URL in.
var SERVER_ATTRS = ["data-src", "data-embed", "data-url", "data-link", "data-iframe", "data-video", "data-source", "data-server", "value"];
var SERVER_TAGS = ["button", "li", "a", "div", "span", "option"];

// Hosts whose players are encrypted/obfuscated beyond what this file decodes.
var UNSUPPORTED_HOSTS = /abyssplayer|abysscdn|hydrax/i;

var GENRES = [
  "Action", "Action & Adventure", "Adult Cast", "Adventure", "Animation", "Anthropomorphic",
  "Award Winning", "Comedy", "Crime", "Crossdressing", "Detective", "Drama", "Ecchi",
  "Educational", "Family", "Fantasy", "Gag Humor", "Gore", "Gourmet", "Harem",
  "High Stakes Game", "Historical", "History", "Horror", "Idols (Male)", "Isekai",
  "Love Polygon", "Love Status Quo", "Magical Sex Shift", "Mahou Shoujo", "Martial Arts",
  "Mecha", "Medical", "Military", "Mystery", "Mythology", "Organized Crime", "Parody",
  "Psychological", "Reincarnation", "Romance", "Samurai", "School", "Sci-Fi",
  "Sci-Fi & Fantasy", "Science Fiction", "Seinen", "Shounen", "Showbiz", "Slice of Life",
  "Space", "Sports", "Strategy Game", "Super Power", "Supernatural", "Survival", "Suspense",
  "Team Sports", "Thriller", "Time Travel", "TV Movie", "Urban Fantasy", "Video Game",
  "Villainess", "Visual Arts", "War", "Western",
];
var LANGS = ["Hindi", "Tamil", "Telugu", "English", "Japanese", "Bengali", "Malayalam", "Kannada"];

class DefaultExtension extends MProvider {
  constructor() {
    super();
    this.client = new Client();
    this._pageMode = 0; // which pagination URL shape worked last
  }

  get ua() {
    return "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";
  }

  get headers() {
    return { "User-Agent": this.ua, "Referer": this.source.baseUrl + "/" };
  }

  get supportsLatest() {
    return true;
  }

  // ------------------------------------------------------------- helpers

  abs(u) {
    u = (u || "").trim();
    if (!u) return "";
    if (u.indexOf("//") === 0) return "https:" + u;
    if (/^https?:/i.test(u)) return u;
    return this.source.baseUrl + (u.charAt(0) === "/" ? "" : "/") + u;
  }

  pref(key, def) {
    try {
      var v = new SharedPreferences().get(key);
      return v === undefined || v === null || v === "" ? def : v;
    } catch (e) {
      return def;
    }
  }

  async fetchHtml(url, hdrs) {
    var res = await this.client.get(this.abs(url), hdrs || this.headers);
    return res.body || "";
  }

  slug(name) {
    return name.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  // Tag-stripped, whitespace-collapsed page text — used for label/value rows
  // whose exact class names are not worth depending on.
  plain(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#0?39;|&rsquo;/g, "'")
      .replace(/\s+/g, " ").trim();
  }

  // Cards/headings render "<English> <romaji>" — the link's title attribute
  // is the romaji half, so stripping it leaves the English half.
  splitTitle(text, jp) {
    text = (text || "").replace(/\s+/g, " ").trim();
    jp = (jp || "").replace(/\s+/g, " ").trim();
    var en = text;
    if (jp && text.length > jp.length && text.slice(-jp.length) === jp) {
      en = text.slice(0, text.length - jp.length).trim();
    }
    var english = this.pref("title_language", "english") === "english";
    return (english ? en || jp || text : jp || en || text);
  }

  imgSrc(img) {
    var s = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src") || "";
    if (s.indexOf("data:") === 0) s = img.attr("data-src") || img.attr("data-lazy-src") || "";
    if (!s) {
      var ss = img.attr("srcset") || "";
      if (ss) s = ss.split(",")[0].trim().split(" ")[0];
    }
    return this.abs(s);
  }

  // ------------------------------------------------------------ list pages

  parseCards(doc) {
    var best = [];
    for (var s = 0; s < CARD_SELECTORS.length; s++) {
      var cards = doc.select(CARD_SELECTORS[s]);
      var out = [], seen = {};
      for (var i = 0; i < cards.length; i++) {
        var c = cards[i];
        var a = c.selectFirst("a[href*='/anime/']") || c.selectFirst("a[href*='/watch/']");
        if (!a) continue;
        var href = this.abs(a.attr("href") || "");
        if (!href || seen[href]) continue;
        var jp = (a.attr("title") || "").trim();
        var h = c.selectFirst("h2, h3, h4");
        var heading = h ? (h.text || "").trim() : "";
        var name = this.splitTitle(heading || jp, jp);
        if (!name) continue;
        var img = c.selectFirst("img");
        seen[href] = true;
        out.push({ name: name, imageUrl: img ? this.imgSrc(img) : "", link: href });
      }
      if (out.length > best.length) best = out;
    }
    if (best.length) return best;

    // Last resort: bare title-bearing anchors.
    var anchors = doc.select("a[href*='/anime/'][title]");
    var seen2 = {};
    for (var j = 0; j < anchors.length; j++) {
      var l = this.abs(anchors[j].attr("href") || "");
      var t = (anchors[j].attr("title") || "").trim();
      if (!l || !t || seen2[l]) continue;
      seen2[l] = true;
      var im = anchors[j].selectFirst("img");
      best.push({ name: t, imageUrl: im ? this.imgSrc(im) : "", link: l });
    }
    return best;
  }

  hasNext(doc, page, count) {
    var next = doc.selectFirst("a.next, .next.page-numbers, a[rel='next']");
    if (next) return true;
    var n = page + 1;
    var links = doc.select("a[href*='/page/" + n + "'], a[href*='paged=" + n + "'], a[href*='page=" + n + "']");
    if (links.length > 0) return true;
    return count >= 12; // a next page that turns out empty just ends the list
  }

  async listFrom(urls, page) {
    for (var i = 0; i < urls.length; i++) {
      try {
        var doc = new Document(await this.fetchHtml(urls[i].u));
        var items = this.parseCards(doc);
        if (items.length) {
          if (urls[i].mode !== undefined) this._pageMode = urls[i].mode;
          return { list: items, hasNextPage: this.hasNext(doc, page, items.length) };
        }
      } catch (e) {}
    }
    return { list: [], hasNextPage: false };
  }

  // /search/ is a page template, so its pagination shape is not guaranteed —
  // try the likely ones, newest-working first.
  searchUrls(params, page) {
    var q = "?" + params;
    if (page <= 1) return [{ u: "/search/" + q, mode: 0 }];
    var all = [
      { u: "/search/page/" + page + "/" + q, mode: 0 },
      { u: "/search/" + q + "&paged=" + page, mode: 1 },
      { u: "/search/" + q + "&page=" + page, mode: 2 },
    ];
    var m = this._pageMode;
    var first = all.filter(function (x) { return x.mode === m; });
    var rest = all.filter(function (x) { return x.mode !== m; });
    return first.concat(rest);
  }

  archiveUrl(type, slug, page) {
    return [{ u: "/" + type + "/" + slug + "/" + (page > 1 ? "page/" + page + "/" : "") }];
  }

  async getPopular(page) {
    return await this.listFrom(this.searchUrls("s_orderby=popular", page), page);
  }

  async getLatestUpdates(page) {
    return await this.listFrom(this.searchUrls("s_orderby=updated&s_order=desc", page), page);
  }

  fval(filters, name) {
    for (var i = 0; i < (filters || []).length; i++) {
      var f = filters[i];
      if (f && f.name === name && f.values) {
        var o = f.values[f.state || 0];
        return o ? o.value : "";
      }
    }
    return "";
  }

  async search(query, page, filters) {
    try {
      query = (query || "").trim();
      if (query) {
        var enc = encodeURIComponent(query);
        var r = await this.listFrom(this.searchUrls("s_keyword=" + enc, page), page);
        if (!r.list.length) {
          var wp = page > 1 ? "/page/" + page + "/?s=" + enc : "/?s=" + enc;
          r = await this.listFrom([{ u: wp }], page);
        }
        return r;
      }
      var genre = this.fval(filters, "Genre");
      if (genre) return await this.listFrom(this.archiveUrl("genre", genre, page), page);
      var lang = this.fval(filters, "Language");
      if (lang) return await this.listFrom(this.archiveUrl("tag", lang, page), page);
      var sort = this.fval(filters, "Sort") || "popular";
      var params = "s_orderby=" + sort + (sort === "updated" ? "&s_order=desc" : "");
      return await this.listFrom(this.searchUrls(params, page), page);
    } catch (e) {
      return { list: [], hasNextPage: false };
    }
  }

  // --------------------------------------------------------------- detail

  parseGenres(doc) {
    // Every page carries the full genre menu in its header, ending in
    // "Western"; the show's own genre links come after it.
    var links = doc.select("a[href*='/genre/']");
    var names = [];
    for (var i = 0; i < links.length; i++) {
      var t = (links[i].text || "").trim();
      if (t) names.push(t);
    }
    var cut = names.indexOf("Western");
    var rest = cut >= 0 ? names.slice(cut + 1) : names;
    var out = [], seen = {};
    for (var j = 0; j < rest.length; j++) {
      if (!seen[rest[j]]) { seen[rest[j]] = true; out.push(rest[j]); }
    }
    return out;
  }

  parseEpisodes(html, scanlator) {
    var doc = new Document(html);
    var links = doc.select("a[href*='/watch/']");
    var seen = {}, eps = [];
    for (var i = 0; i < links.length; i++) {
      var href = this.abs(links[i].attr("href") || "");
      var m = href.match(/-episode-(\d+)\/?$/);
      if (!m) continue;
      var n = parseInt(m[1], 10);
      if (seen[n]) continue;
      seen[n] = true;
      var t = (links[i].text || "").replace(/\s+/g, " ").trim();
      var title = t.replace(new RegExp("^" + n + "\\s*"), "").trim();
      eps.push({
        n: n,
        name: "Episode " + n + (title ? ": " + title : ""),
        url: href,
        scanlator: scanlator,
      });
    }
    eps.sort(function (a, b) { return b.n - a.n; }); // newest first
    return eps.map(function (e) { return { name: e.name, url: e.url, scanlator: e.scanlator }; });
  }

  async getDetail(url) {
    var link = this.abs(url);
    var html = await this.fetchHtml(link);
    var watchHtml = "";

    // A "latest episode" card links to /watch/…; hop to the series page.
    if (link.indexOf("/watch/") >= 0) {
      watchHtml = html;
      var a0 = new Document(html).selectFirst("a[href*='/anime/']");
      if (!a0) throw new Error("Could not find the series page for " + link);
      link = this.abs(a0.attr("href"));
      html = await this.fetchHtml(link);
    }

    var doc = new Document(html);
    var text = this.plain(html);

    var titleEl = doc.selectFirst("title");
    var jp = titleEl ? (titleEl.text || "").replace(/\s*[-|–]\s*Desi\s*Dub\s*Anime\s*$/i, "").trim() : "";
    var h1 = doc.selectFirst("h1");
    var name = this.splitTitle(h1 ? h1.text : jp, jp);

    var imageUrl = "";
    var imgs = doc.select("img");
    for (var i = 0; i < imgs.length; i++) {
      var src = this.imgSrc(imgs[i]);
      if (/myanimelist\.net|anilistcdn|tmdb\.org/i.test(src)) { imageUrl = src; break; }
    }
    if (!imageUrl) {
      var og = doc.selectFirst("meta[property='og:image']");
      if (og) imageUrl = og.attr("content") || "";
    }

    var description = "";
    var dm = text.match(/Overview\s+(.+?)\s+Read More/i);
    if (dm) description = dm[1];
    if (!description) {
      var meta = doc.selectFirst("meta[name='description']");
      if (meta) description = meta.attr("content") || "";
    }
    description = description.replace(/\s*\[Written by[^\]]*\]\s*$/i, "").trim();

    var status = 5;
    var am = text.match(/Aired\s+(.+?)\s+(?:Season|Released Year|Studios)\b/);
    if (am) {
      if (/\?\s*$/.test(am[1])) status = 0;
      else if (/\sto\s/.test(am[1])) status = 1;
    }
    var sm = text.match(/Studios\s+(.+?)\s+(?:Genres|Producers)\b/);
    var author = sm ? sm[1].trim() : "";
    var bm = text.match(/\b(Hindi DUB|Tamil DUB|Telugu DUB|English DUB|Multi Audio|SUB)\b/);
    var audio = bm ? bm[1] : "";

    // The series page only shows the 10 newest episodes ("Load More" is
    // AJAX), but any watch page carries the full list.
    if (!watchHtml) {
      var wl = doc.select("a[href*='/watch/']");
      var pick = "";
      for (var w = 0; w < wl.length; w++) {
        var h = wl[w].attr("href") || "";
        if (!pick) pick = h;
        if (/watch\s*now/i.test(wl[w].text || "")) { pick = h; break; }
      }
      if (pick) {
        try { watchHtml = await this.fetchHtml(pick); } catch (e) {}
      }
    }
    var chapters = watchHtml ? this.parseEpisodes(watchHtml, audio) : [];
    if (!chapters.length) chapters = this.parseEpisodes(html, audio);

    return {
      name: name,
      imageUrl: imageUrl,
      description: description,
      author: author,
      genre: this.parseGenres(doc),
      status: status,
      link: link,
      chapters: chapters,
    };
  }

  // -------------------------------------------------------------- videos

  // Pure-JS base64 decoder — atob() is not available in Mangayomi's QuickJS runtime.
  b64dec(s) {
    var t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    s = String(s).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/]/g, "");
    var out = "", i = 0;
    while (i < s.length) {
      var a = t.indexOf(s[i++]), b = t.indexOf(s[i++]);
      var c = t.indexOf(s[i++]), d = t.indexOf(s[i++]);
      if (a < 0 || b < 0) break;
      out += String.fromCharCode((a << 2) | (b >> 4));
      if (c >= 0) out += String.fromCharCode(((b & 15) << 4) | (c >> 2));
      if (d >= 0) out += String.fromCharCode(((c & 3) << 6) | d);
    }
    return out;
  }

  normalizeEmbed(raw) {
    raw = (raw || "").trim();
    if (!raw) return "";
    if (/^(https?:)?\/\//i.test(raw)) return this.abs(raw);
    var dec = this.b64dec(raw);
    var im = dec.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (im) return this.abs(im[1]);
    if (/^(https?:)?\/\/[^\s]+$/i.test(dec)) return this.abs(dec);
    return "";
  }

  hostLabel(u) {
    var m = u.match(/\/\/(?:www\.)?([^\/.]+)/);
    var n = m ? m[1] : "Server";
    return n.charAt(0).toUpperCase() + n.slice(1);
  }

  collectEmbeds(doc, html) {
    var self = this, found = [], seen = {};
    var add = function (raw, label, audio) {
      var u = self.normalizeEmbed(raw);
      if (!u || seen[u]) return;
      if (/\.(?:jpe?g|png|gif|webp|svg|css|js|ico)(?:[?#]|$)/i.test(u)) return;
      seen[u] = true;
      found.push({ url: u, label: (label || "").replace(/\s+/g, " ").trim() || self.hostLabel(u), audio: audio || "" });
    };

    // 1) the iframe the page loads by default
    var frames = doc.select("iframe");
    for (var i = 0; i < frames.length; i++) {
      add(frames[i].attr("src") || frames[i].attr("data-src"), "", "");
    }

    // 2) the server / mirror buttons (SUB row and DUB row)
    var sels = [];
    for (var t = 0; t < SERVER_TAGS.length; t++) {
      for (var a = 0; a < SERVER_ATTRS.length; a++) sels.push(SERVER_TAGS[t] + "[" + SERVER_ATTRS[a] + "]");
    }
    var els = doc.select(sels.join(", "));
    for (var e = 0; e < els.length; e++) {
      for (var k = 0; k < SERVER_ATTRS.length; k++) {
        var v = els[e].attr(SERVER_ATTRS[k]);
        if (v) {
          add(v, els[e].text, els[e].attr("data-type") || els[e].attr("data-lang") || els[e].attr("data-audio") || "");
          break;
        }
      }
    }

    // 3) hosts spotted anywhere in the page source (inline JS, JSON blobs)
    var re = /(?:https?:)?\/\/(?:player\.abyssplayer\.com|[a-z0-9.-]*(?:streamruby|rubystm|vmoly|moly)[a-z0-9.-]*)\/[^"'\s<>\\]+/gi;
    var m;
    while ((m = re.exec(html.replace(/\\\//g, "/")))) add(m[0], "", "");
    return found;
  }

  // Dean Edwards p.a.c.k.e.r. — most of these embed hosts ship their player
  // config through it.
  unpack(src) {
    var m = /\}\('([\s\S]*?)',\s*(\d+),\s*(\d+),\s*'([\s\S]*?)'\.split\('\|'\)/.exec(src || "");
    if (!m) return "";
    var payload = m[1].replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    var radix = parseInt(m[2], 10), count = parseInt(m[3], 10), dict = m[4].split("|");
    var enc = function (n) {
      return (n < radix ? "" : enc(Math.floor(n / radix))) +
        ((n = n % radix) > 35 ? String.fromCharCode(n + 29) : n.toString(36));
    };
    while (count--) {
      if (dict[count]) payload = payload.replace(new RegExp("\\b" + enc(count) + "\\b", "g"), dict[count]);
    }
    return payload;
  }

  findMedia(text) {
    var t = String(text || "").replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&");
    var pats = [
      /(?:file|src|source|hls\d*|url)["']?\s*[:=]\s*["'](https?:\/\/[^"'\s]+?\.(?:m3u8|mp4)[^"'\s]*)["']/i,
      /["'](https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*)["']/i,
      /["'](https?:\/\/[^"'\s]+?\.mp4[^"'\s]*)["']/i,
    ];
    for (var i = 0; i < pats.length; i++) {
      var m = t.match(pats[i]);
      if (m) return m[1];
    }
    return "";
  }

  findSubtitles(text) {
    var t = String(text || "").replace(/\\\//g, "/");
    var out = [], re = /["'](https?:\/\/[^"'\s]+?\.(?:vtt|srt))["']/gi, m;
    while ((m = re.exec(t))) out.push({ file: m[1], label: "Subtitle " + (out.length + 1) });
    return out;
  }

  async hlsVariants(master, hdrs) {
    var out = [];
    try {
      var res = await this.client.get(master, hdrs);
      var body = res.body || "";
      if (body.indexOf("#EXT-X-STREAM-INF") < 0) return out;
      var base = master.replace(/[?#].*$/, "");
      var origin = (base.match(/^(https?:\/\/[^\/]+)/) || ["", ""])[1];
      var dir = base.substring(0, base.lastIndexOf("/") + 1);
      var lines = body.split(/\r?\n/);
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("#EXT-X-STREAM-INF") !== 0) continue;
        var rm = lines[i].match(/RESOLUTION=\d+x(\d+)/);
        var uri = "";
        for (var j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() && lines[j].charAt(0) !== "#") { uri = lines[j].trim(); break; }
        }
        if (!uri) continue;
        var full = /^https?:/i.test(uri) ? uri : uri.charAt(0) === "/" ? origin + uri : dir + uri;
        out.push({ url: full, h: rm ? parseInt(rm[1], 10) : 0, label: rm ? rm[1] + "p" : "Variant" });
      }
      out.sort(function (a, b) { return b.h - a.h; });
    } catch (e) {}
    return out;
  }

  async resolveEmbed(e, depth) {
    var streams = [];
    try {
      if (UNSUPPORTED_HOSTS.test(e.url)) return streams;
      var tag = e.label + (e.audio ? " " + String(e.audio).toUpperCase() : "");
      var origin = (e.url.match(/^(https?:\/\/[^\/]+)/) || ["", ""])[1];
      var hdrs = { "User-Agent": this.ua, "Referer": origin + "/" };
      var media = "", body = "";

      if (/\.(?:m3u8|mp4)(?:[?#]|$)/i.test(e.url)) {
        media = e.url;
      } else {
        var res = await this.client.get(e.url, { "User-Agent": this.ua, "Referer": this.source.baseUrl + "/" });
        body = res.body || "";
        media = this.findMedia(body);
        if (!media) {
          var un = this.unpack(body);
          if (un) { body = body + "\n" + un; media = this.findMedia(un); }
        }
        if (!media && !depth) {
          var nm = body.match(/<iframe[^>]+src=["']([^"']+)["']/i);
          if (nm) {
            return await this.resolveEmbed({ url: this.abs(nm[1]), label: e.label, audio: e.audio }, 1);
          }
        }
      }
      if (!media) return streams;

      var subs = this.findSubtitles(body);
      if (/\.m3u8/i.test(media)) {
        streams.push({ url: media, originalUrl: media, quality: tag + " - Auto", headers: hdrs, subtitles: subs });
        var vars = await this.hlsVariants(media, hdrs);
        for (var i = 0; i < vars.length; i++) {
          streams.push({ url: vars[i].url, originalUrl: vars[i].url, quality: tag + " - " + vars[i].label, headers: hdrs, subtitles: subs });
        }
      } else {
        streams.push({ url: media, originalUrl: media, quality: tag, headers: hdrs, subtitles: subs });
      }
    } catch (err) {}
    return streams;
  }

  async getVideoList(url) {
    var html = await this.fetchHtml(url);
    var doc = new Document(html);
    var embeds = this.collectEmbeds(doc, html);
    var streams = [];
    for (var i = 0; i < embeds.length && i < 10; i++) {
      var got = await this.resolveEmbed(embeds[i], 0);
      for (var j = 0; j < got.length; j++) streams.push(got[j]);
    }

    var prefServer = String(this.pref("preferred_server", "any")).toLowerCase();
    var prefQuality = String(this.pref("preferred_quality", "any"));
    var score = function (s) {
      var q = String(s.quality || "").toLowerCase();
      var sc = 0;
      if (prefServer !== "any" && q.indexOf(prefServer) >= 0) sc += 100;
      if (prefQuality !== "any" && q.indexOf(prefQuality + "p") >= 0) sc += 10;
      return sc;
    };
    streams.sort(function (a, b) { return score(b) - score(a); });
    return streams;
  }

  // ------------------------------------------------- filters & preferences

  getFilterList() {
    var opt = function (name, value) { return { type_name: "SelectOption", name: name, value: value }; };
    var self = this;
    return [
      { type_name: "HeaderFilter", name: "Typed search wins; then Genre, then Language, then Sort" },
      {
        type_name: "SelectFilter", name: "Language", state: 0,
        values: [opt("Any", "")].concat(LANGS.map(function (l) { return opt(l, l.toLowerCase()); })),
      },
      {
        type_name: "SelectFilter", name: "Genre", state: 0,
        values: [opt("Any", "")].concat(GENRES.map(function (g) { return opt(g, self.slug(g)); })),
      },
      {
        type_name: "SelectFilter", name: "Sort", state: 0,
        values: [opt("Most popular", "popular"), opt("Recently updated", "updated"), opt("Newest", "date")],
      },
    ];
  }

  getSourcePreferences() {
    return [
      {
        key: "title_language",
        listPreference: {
          title: "Title language",
          summary: "%s",
          valueIndex: 0,
          entries: ["English", "Romaji / native"],
          entryValues: ["english", "native"],
        },
      },
      {
        key: "preferred_quality",
        listPreference: {
          title: "Preferred quality",
          summary: "%s",
          valueIndex: 0,
          entries: ["Any (server order)", "1080p", "720p", "480p"],
          entryValues: ["any", "1080", "720", "480"],
        },
      },
      {
        key: "preferred_server",
        listPreference: {
          title: "Preferred server",
          summary: "%s",
          valueIndex: 0,
          entries: ["Any", "SRuby", "Mirror", "VMoly"],
          entryValues: ["any", "sruby", "mirror", "vmoly"],
        },
      },
    ];
  }
}
