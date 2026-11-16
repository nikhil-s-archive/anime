import * as cheerio from "cheerio";

/**
 * Mangayomi Document parser using Cheerio.
 */
export class Document {
  constructor(html) {
    this.$ = cheerio.load(html || "");
  }

  select(selector) {
    if (!selector) return [];
    try {
      return this.$(selector).toArray().map((el) => new MElement(this.$, el));
    } catch {
      return [];
    }
  }

  selectFirst(selector) {
    if (!selector) return null;
    try {
      const el = this.$(selector).first();
      return el.length ? new MElement(this.$, el) : null;
    } catch {
      return null;
    }
  }
}

/**
 * Mangayomi Element wrapper.
 */
export class MElement {
  constructor($, el) {
    this.$ = $;
    this.el = el;
  }

  attr(name) {
    if (!name) return "";
    const v = this.$(this.el).attr(name);
    return v === undefined || v === null ? "" : String(v);
  }

  get text() {
    return this.$(this.el).text() || "";
  }

  get innerHtml() {
    return this.$(this.el).html() || "";
  }

  get html() {
    return this.$(this.el).html() || "";
  }

  select(selector) {
    if (!selector) return [];
    try {
      return this.$(this.el).find(selector).toArray().map((e) => new MElement(this.$, e));
    } catch {
      return [];
    }
  }

  selectFirst(selector) {
    if (!selector) return null;
    try {
      const el = this.$(this.el).find(selector).first();
      return el.length ? new MElement(this.$, el) : null;
    } catch {
      return null;
    }
  }
}

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

/**
 * Mangayomi HTTP client bridge over standard fetch.
 */
export class Client {
  async get(url, headers = {}) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      const reqHeaders = { "User-Agent": DEFAULT_UA, ...headers };
      const res = await fetch(url, {
        headers: reqHeaders,
        redirect: "follow",
        signal: ctrl.signal,
      });
      const body = await res.text();
      return {
        body,
        statusCode: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async post(url, headers = {}, body = null) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 20000);
    try {
      let reqBody = body;
      if (
        typeof body === "object" &&
        body !== null &&
        !(body instanceof FormData) &&
        !(body instanceof URLSearchParams)
      ) {
        reqBody = JSON.stringify(body);
      }
      const reqHeaders = { "User-Agent": DEFAULT_UA, ...headers };
      const res = await fetch(url, {
        method: "POST",
        headers: reqHeaders,
        body: reqBody,
        redirect: "follow",
        signal: ctrl.signal,
      });
      const resBody = await res.text();
      return {
        body: resBody,
        statusCode: res.status,
        headers: Object.fromEntries(res.headers.entries()),
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Preferences storage dummy (defaults used).
 */
export class SharedPreferences {
  get(key) {
    return null;
  }
  set(key, val) {}
}

/**
 * Mangayomi Provider base class.
 */
export class MProvider {
  constructor() {
    this.source = null;
  }
}
