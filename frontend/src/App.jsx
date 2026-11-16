/**
 * App.jsx — AnimeX multi-platform application
 *
 * Supported platforms: All sources from Mangayomi anime extensions
 * Dynamic platform switching with logo and name on the top right
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Player from "./components/Player.jsx";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Set VITE_API_BASE in your .env for production, e.g. https://animex.worker.dev */
const API_BASE = import.meta.env.VITE_API_BASE || "";

// Default list of 17 platforms from anime_index.json for instant rendering
const DEFAULT_PLATFORMS = [
  {
    name: "AniKoto",
    id: 1356478902,
    baseUrl: "https://anikototv.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://anikototv.to",
  },
  {
    name: "ReAnime",
    id: 631942785,
    baseUrl: "https://reanime.cz",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://reanime.cz",
  },
  {
    name: "Senshi",
    id: 728461935,
    baseUrl: "https://senshi.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://senshi.to",
  },
  {
    name: "MyroniX",
    id: 347219856,
    baseUrl: "https://myronix.strangled.net",
    lang: "en",
    iconUrl: "https://myronix.strangled.net/images/axolotl.png",
  },
  {
    name: "AllWish",
    id: -228451656,
    baseUrl: "https://all-wish.me",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://all-wish.me",
  },
  {
    name: "JustAnime",
    id: 892345671,
    baseUrl: "https://justanime.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://justanime.to",
  },
  {
    name: "HiAnime",
    id: 1183439094,
    baseUrl: "https://hianime.at",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://hianime.at",
  },
  {
    name: "AnimeParadise",
    id: 419768715,
    baseUrl: "https://animeparadise.moe",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=128&domain=https://animeparadise.moe",
  },
  {
    name: "Playback Diagnostic",
    id: 918273645,
    baseUrl: "https://example.invalid",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://apple.com",
  },
  {
    name: "AniPM",
    id: 1742685193,
    baseUrl: "https://ani.pm",
    lang: "en",
    iconUrl: "https://ani.pm/apple-touch-icon.png",
  },
  {
    name: "Anidap",
    id: 543219876,
    baseUrl: "https://anidap.lol",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://anidap.lol",
  },
  {
    name: "Miruro",
    id: 617345892,
    baseUrl: "https://www.miruro.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://www.miruro.to",
  },
  {
    name: "AniWave",
    id: -367725331,
    baseUrl: "https://aniwaves.ru",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://aniwaves.ru",
  },
  {
    name: "1Anime",
    id: 384756102,
    baseUrl: "https://1anime.app",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://1anime.app",
  },
  {
    name: "AnimeHeaven",
    id: -1744325818,
    baseUrl: "https://animeheaven.me",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://animeheaven.me",
  },
  {
    name: "Anichi",
    id: 878498226,
    baseUrl: "https://anichi.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://anichi.to",
  },
  {
    name: "AnimeKai",
    id: 232158530,
    baseUrl: "https://animekaitv.to",
    lang: "en",
    iconUrl:
      "https://www.google.com/s2/favicons?sz=256&domain=https://animekaitv.to",
  },
];

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

const api = {
  platforms: () => apiFetch(`/api/platforms`),
  latest: (page = 1, platform = "") =>
    apiFetch(
      `/api/latest?page=${page}${
        platform ? `&platform=${encodeURIComponent(platform)}` : ""
      }`
    ),
  popular: (page = 1, platform = "") =>
    apiFetch(
      `/api/popular?page=${page}${
        platform ? `&platform=${encodeURIComponent(platform)}` : ""
      }`
    ),
  search: (q, page = 1, platform = "") =>
    apiFetch(
      `/api/search?q=${encodeURIComponent(q)}&page=${page}${
        platform ? `&platform=${encodeURIComponent(platform)}` : ""
      }`
    ),
  episodes: (url, platform = "") =>
    apiFetch(
      `/api/episodes?url=${encodeURIComponent(url)}${
        platform ? `&platform=${encodeURIComponent(platform)}` : ""
      }`
    ),
  extract: (url, opts = {}) => {
    const params = new URLSearchParams();
    if (url) params.set("url", url);
    if (opts.type) params.set("type", opts.type);
    if (opts.server) params.set("server", opts.server);
    if (opts.linkId) params.set("linkId", opts.linkId);
    if (opts.platform) params.set("platform", opts.platform);
    return apiFetch(`/api/extract?${params.toString()}`);
  },
  /** Build the proxied HLS manifest URL */
  proxyHls: (streamUrl) => {
    if (!streamUrl) return "";
    if (streamUrl.includes("/proxy/hls?url=")) {
      if (streamUrl.startsWith("http")) return streamUrl;
      return `${API_BASE}${streamUrl}`;
    }
    return `${API_BASE}/proxy/hls?url=${encodeURIComponent(streamUrl)}`;
  },
};

// ─── Routing & History Helpers ────────────────────────────────────────────────

function toSlug(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findPlatformBySlug(slug, list = []) {
  if (!slug) return null;
  const clean = slug.toLowerCase();
  return (
    list.find(
      (p) => toSlug(p.name) === clean || p.name.toLowerCase() === clean
    ) || null
  );
}

function parsePath(pathname = window.location.pathname) {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) {
    return { type: "landing" };
  }
  if (parts[0].toLowerCase() === "home") {
    return { type: "home" };
  }
  if (parts.length === 1) {
    return {
      type: "platform",
      platformSlug: parts[0],
    };
  }
  if (parts.length === 2) {
    return {
      type: "anime",
      platformSlug: parts[0],
      animeSlug: parts[1],
    };
  }
  return {
    type: "episode",
    platformSlug: parts[0],
    animeSlug: parts[1],
    episodeNum: parts[2],
  };
}

function cacheAnime(platformSlug, animeSlug, item) {
  try {
    const key = `animex_anime_${platformSlug}_${animeSlug}`;
    localStorage.setItem(key, JSON.stringify(item));
  } catch (_) {}
}

function getCachedAnime(platformSlug, animeSlug) {
  try {
    const key = `animex_anime_${platformSlug}_${animeSlug}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function loadWatchHistory() {
  try {
    const raw = localStorage.getItem("animex_watch_history");
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveWatchHistoryEntry(entry) {
  try {
    const history = loadWatchHistory();
    const updated = [
      entry,
      ...history.filter(
        (h) =>
          !(h.animeSlug === entry.animeSlug && h.platformSlug === entry.platformSlug)
      ),
    ].slice(0, 24);
    localStorage.setItem("animex_watch_history", JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

function removeWatchHistoryEntry(item) {
  try {
    const history = loadWatchHistory();
    const updated = history.filter(
      (h) =>
        !(
          h.animeSlug === item.animeSlug &&
          h.platformSlug === item.platformSlug &&
          String(h.episodeNum) === String(item.episodeNum)
        )
    );
    localStorage.setItem("animex_watch_history", JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

function clearWatchHistoryStorage() {
  try {
    localStorage.removeItem("animex_watch_history");
  } catch (_) {}
  return [];
}

function loadSearchHistory() {
  try {
    const raw = localStorage.getItem("animex_search_history");
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveSearchHistoryEntry(query) {
  if (!query || !query.trim()) return loadSearchHistory();
  const q = query.trim();
  try {
    const history = loadSearchHistory();
    const updated = [
      q,
      ...history.filter((item) => item.toLowerCase() !== q.toLowerCase()),
    ].slice(0, 10);
    localStorage.setItem("animex_search_history", JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

function removeSearchHistoryEntry(query) {
  try {
    const history = loadSearchHistory();
    const updated = history.filter(
      (item) => item.toLowerCase() !== query.toLowerCase()
    );
    localStorage.setItem("animex_search_history", JSON.stringify(updated));
    return updated;
  } catch (_) {
    return [];
  }
}

function clearSearchHistoryStorage() {
  try {
    localStorage.removeItem("animex_search_history");
  } catch (_) {}
  return [];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SearchIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  );
}

function AnimeArtworkIcon({ className = "h-8 w-8" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.8 14.2 8l5.5-1.6-1.6 5.5 5.1 2.1-5.1 2.1 1.6 5.5-5.5-1.6L12 25l-2.1-5.1-5.5 1.6L6 16l-5.1-2.1L6 11.8 4.4 6.3 9.9 8z" transform="translate(0 -1.5) scale(.92)" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DisplayIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4m-2-12 5 2.5-5 2.5z" />
    </svg>
  );
}

function WarningIcon({ className = "h-5 w-5" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m10.3 3.8-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4m0 4h.01" />
    </svg>
  );
}

function ChevronIcon({ className = "h-4 w-4" }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Animated skeleton card for loading state */
function SkeletonCard() {
  return (
    <div
      className="rounded-[24px] overflow-hidden"
      style={{ aspectRatio: "2/3" }}
    >
      <div className="skeleton w-full h-full" />
    </div>
  );
}

function SearchBar({ value, onChange, onSubmit, onChoose, platform }) {
  const [focused, setFocused] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionError, setSuggestionError] = useState("");
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const blurTimer = useRef(null);
  const query = value.trim();

  useEffect(() => {
    if (!focused || query.length < 2) {
      setSuggestions([]);
      setSuggestionError("");
      setLoadingSuggestions(false);
      return undefined;
    }

    setSuggestions([]);
    setSuggestionError("");
    setLoadingSuggestions(true);
    setActiveIndex(-1);
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoadingSuggestions(true);
      setSuggestionError("");
      api
        .search(query, 1, platform)
        .then((data) => {
          if (cancelled) return;
          setSuggestions((data.items || []).slice(0, 6));
          setActiveIndex(-1);
        })
        .catch((error) => {
          if (cancelled) return;
          setSuggestions([]);
          setSuggestionError(error.message);
        })
        .finally(() => {
          if (!cancelled) setLoadingSuggestions(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [focused, platform, query]);

  const chooseSuggestion = (item) => {
    clearTimeout(blurTimer.current);
    setFocused(false);
    onChoose(item);
  };

  const handleKeyDown = (event) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveIndex((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1
      );
    } else if (event.key === "Escape") {
      setFocused(false);
      setActiveIndex(-1);
    } else if (
      event.key === "Enter" &&
      activeIndex >= 0 &&
      suggestions[activeIndex]
    ) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeIndex]);
    }
  };

  const showMenu =
    focused &&
    query.length >= 2 &&
    (loadingSuggestions || suggestions.length > 0 || suggestionError);

  return (
    <form onSubmit={onSubmit} className="search-form">
      <div className="search-control-wrap">
        <div className="home-search">
          <SearchIcon className="h-5 w-5 flex-shrink-0" />
          <input
            type="search"
            role="combobox"
            aria-label="Search anime"
            aria-autocomplete="list"
            aria-expanded={Boolean(showMenu)}
            aria-controls="anime-search-suggestions"
            aria-activedescendant={
              activeIndex >= 0 ? `anime-suggestion-${activeIndex}` : undefined
            }
            placeholder={`Search ${platform} anime`}
            value={value}
            onFocus={() => {
              clearTimeout(blurTimer.current);
              setFocused(true);
            }}
            onBlur={() => {
              blurTimer.current = setTimeout(() => setFocused(false), 120);
            }}
            onKeyDown={handleKeyDown}
            onChange={(event) => onChange(event.target.value)}
          />
          {value && (
            <button
              type="button"
              className="clear-search"
              onClick={() => onChange("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {showMenu && (
          <div
            id="anime-search-suggestions"
            className="suggestion-menu"
            role="listbox"
            aria-label="Search suggestions"
          >
            {loadingSuggestions && (
              <p className="suggestion-status">Looking for anime…</p>
            )}
            {suggestions.map((item, index) => (
              <button
                type="button"
                id={`anime-suggestion-${index}`}
                key={`${item.url || item.link}-${index}`}
                className={`suggestion-option ${
                  activeIndex === index ? "is-active" : ""
                }`}
                role="option"
                aria-selected={activeIndex === index}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => chooseSuggestion(item)}
              >
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" loading="lazy" />
                ) : (
                  <span className="suggestion-placeholder" aria-hidden="true">
                    <AnimeArtworkIcon className="h-5 w-5" />
                  </span>
                )}
                <span className="suggestion-copy">
                  <span className="suggestion-title">{item.title}</span>
                  {item.episodeLabel && (
                    <span className="suggestion-detail">{item.episodeLabel}</span>
                  )}
                </span>
                <span className="suggestion-enter" aria-hidden="true">↵</span>
              </button>
            ))}
            {suggestionError && (
              <p className="suggestion-status">
                Suggestions unavailable: {suggestionError}
              </p>
            )}
            {!loadingSuggestions && !suggestionError && suggestions.length === 0 && (
              <p className="suggestion-status">No matches found.</p>
            )}
          </div>
        )}
      </div>
      <button type="submit" className="search-submit">Search</button>
    </form>
  );
}

/** Individual anime card */
function AnimeCard({ item, isActive, onClick }) {
  const [imgError, setImgError] = useState(false);

  return (
    <article
      className={`anime-card group ${isActive ? "active" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      aria-label={`Watch ${item.title}`}
    >
      {/* Thumbnail */}
      {!imgError && item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500
                     group-hover:scale-110"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-navy-800">
          <AnimeArtworkIcon className="h-9 w-9 opacity-50" />
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.15) 48%, transparent 100%)",
        }}
      />

      {/* Episode badge */}
      {item.episodeLabel && (
        <span className="ep-pill">{item.episodeLabel}</span>
      )}

      {/* Title on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3"
      >
        <p className="text-ivory text-sm font-semibold line-clamp-2 leading-tight">
          {item.title}
        </p>
        {item.platform && (
          <p className="text-gold text-[10px] mt-0.5 font-mono">
            {item.platform}
          </p>
        )}
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute inset-0 ring-2 ring-white rounded-[24px] pointer-events-none" />
      )}
    </article>
  );
}

/**
 * EpisodeGrid Component
 * - Renders episodes in a clean responsive grid without episode names (just numbers)
 * - If total episodes > 100, groups them into chunks of 100 with a clean Apple-glass <select> dropdown (e.g. 1-100, 101-200)
 * - Highlights the currently active/playing episode
 */
function EpisodeGrid({
  episodes = [],
  activeEpisode = null,
  onSelectEpisode,
  loading = false,
  platformName = "",
}) {
  const chunkSize = 100;
  const totalChunks = Math.max(1, Math.ceil(episodes.length / chunkSize));
  const [selectedChunk, setSelectedChunk] = useState(0);

  // Sync selected chunk when activeEpisode changes
  useEffect(() => {
    if (!activeEpisode || episodes.length === 0) return;
    const idx = episodes.findIndex(
      (e) =>
        String(e.episode) === String(activeEpisode.episode) ||
        e.url === activeEpisode.url
    );
    if (idx !== -1) {
      const chunk = Math.floor(idx / chunkSize);
      setSelectedChunk(chunk);
    }
  }, [activeEpisode, episodes]);

  const currentChunk = Math.min(selectedChunk, totalChunks - 1);
  const startIdx = currentChunk * chunkSize;
  const endIdx = Math.min((currentChunk + 1) * chunkSize, episodes.length);
  const currentEpisodes = episodes.slice(startIdx, endIdx);

  return (
    <div className="glass rounded-[24px] p-4 sm:p-5 border border-white/12 animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Episodes
          </h3>
          <span className="text-[11px] font-mono text-ivory-muted/80 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
            {episodes.length} total
          </span>
        </div>

        {/* 100-Episode Chunk Selector */}
        {totalChunks > 1 && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="episode-chunk-select"
              className="text-xs font-mono text-ivory-muted/70"
            >
              Range:
            </label>
            <div className="relative">
              <select
                id="episode-chunk-select"
                value={currentChunk}
                onChange={(e) => setSelectedChunk(Number(e.target.value))}
                className="appearance-none bg-black/60 border border-white/15 rounded-full pl-4 pr-8 py-1.5 text-xs font-mono font-semibold text-white focus:outline-none focus:border-white/30 backdrop-blur-xl cursor-pointer shadow-sm"
              >
                {Array.from({ length: totalChunks }).map((_, i) => {
                  const s = i * chunkSize;
                  const e = Math.min((i + 1) * chunkSize, episodes.length);
                  const chunkSlice = episodes.slice(s, e);
                  const firstNum = chunkSlice[0]?.episode;
                  const lastNum = chunkSlice[chunkSlice.length - 1]?.episode;
                  const label =
                    firstNum && lastNum && firstNum !== lastNum
                      ? `${firstNum} - ${lastNum}`
                      : `${s + 1} - ${e}`;
                  return (
                    <option key={i} value={i} className="bg-navy-900 text-white">
                      {label}
                    </option>
                  );
                })}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-white/70">
                ▼
              </span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-2xl" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <div className="p-6 text-center text-ivory-muted text-xs">
          No episodes found on {platformName || "platform"}.
        </div>
      ) : (
        <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 max-h-72 overflow-y-auto pr-1 no-scrollbar">
          {currentEpisodes.map((ep) => {
            const isActive =
              activeEpisode &&
              (String(activeEpisode.episode) === String(ep.episode) ||
                activeEpisode.url === ep.url);
            return (
              <button
                key={ep.url || ep.episode}
                type="button"
                onClick={() => onSelectEpisode(ep)}
                title={ep.label || `Episode ${ep.episode}`}
                className={`h-10 rounded-2xl flex items-center justify-center text-xs sm:text-sm font-semibold transition-colors duration-150 border ${
                  isActive
                    ? "bg-white text-black border-white shadow-lg shadow-white/20 font-bold"
                    : "bg-white/8 hover:bg-white/18 text-white/90 border-white/10 hover:border-white/25"
                }`}
              >
                {ep.episode}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Pagination controls */
function Pagination({ page, totalPages, onPrev, onNext }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-8">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      <span className="text-ivory-muted text-sm font-mono tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page >= totalPages}
        className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}

/** Global error toast */
function ErrorToast({ message, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up
                 glass rounded-full px-5 py-3 flex items-center gap-3 max-w-sm w-full border border-white/15 bg-black/80 backdrop-blur-2xl shadow-2xl"
      role="alert"
    >
      <WarningIcon className="h-5 w-5 flex-shrink-0 text-red-400" />
      <p className="text-white/90 text-sm flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-ivory-muted hover:text-white transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Header Source Selector Component
 * Replaces AnimeX brand in the header with the active source platform,
 * allowing instant switching directly from the top-left header.
 */
function PlatformSelector({ platforms, selectedPlatform, onSelectPlatform }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [logoError, setLogoError] = useState(false);
  const dropdownRef = useRef(null);

  // Reset logo error when selectedPlatform changes
  useEffect(() => {
    setLogoError(false);
  }, [selectedPlatform?.name]);

  // Close dropdown on outside click or ESC key
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const filtered = platforms.filter(
    (p) =>
      p.name.toLowerCase().includes(filter.toLowerCase()) ||
      (p.baseUrl && p.baseUrl.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef}>
      {/* ── Header Source Button (Replaces AnimeX) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 flex-shrink-0 group cursor-pointer focus:outline-none"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Source: ${selectedPlatform?.name || "Select Source"} (Click to switch)`}
      >
        {/* Source Logo */}
        <div className="w-9 h-9 rounded-2xl overflow-hidden bg-white/10 border border-white/15 flex items-center justify-center p-1 group-hover:scale-105 group-hover:border-gold/40 transition-all backdrop-blur-md shadow-sm">
          {!logoError && selectedPlatform?.iconUrl ? (
            <img
              src={selectedPlatform.iconUrl}
              alt={selectedPlatform.name}
              className="w-full h-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <AnimeArtworkIcon className="h-5 w-5 text-ivory-muted" />
          )}
        </div>

        {/* Source Name & Switcher indicator */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-white font-extrabold text-lg tracking-tight leading-none group-hover:text-gold transition-colors">
              {selectedPlatform?.name || "Select Source"}
            </span>
            <span
              className={`text-[9px] text-ivory-muted/70 transition-transform duration-200 group-hover:text-gold ${
                isOpen ? "rotate-180" : ""
              }`}
            >
              ▼
            </span>
          </div>
          <span className="text-[10px] text-ivory-muted/70 font-mono leading-none mt-0.5 flex items-center gap-1">
            <span>Source</span>
            <span className="text-[8px] opacity-40">·</span>
            <span className="text-gold/90 font-medium group-hover:underline">Switch</span>
          </span>
        </div>
      </button>

      {/* ── Dropdown Menu ── */}
      {isOpen && (
        <div className="absolute left-0 mt-2.5 w-72 sm:w-80 rounded-[28px] glass p-3.5 z-50 shadow-2xl border border-white/15 animate-slide-up backdrop-blur-3xl">
          {/* Header & Search */}
          <div className="p-1 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white">Select Source</span>
              <span className="text-[10px] font-mono text-white/80 bg-white/10 px-2 py-0.5 rounded-full border border-white/15">
                {platforms.length} sources
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory-muted/60 pointer-events-none">
                <SearchIcon className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search platforms..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-black/50 border border-white/12 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-ivory-muted/60 outline-none focus:border-white/30 backdrop-blur-md"
                autoFocus
              />
            </div>
          </div>

          {/* Platforms List */}
          <div className="max-h-64 overflow-y-auto space-y-1 no-scrollbar pr-0.5">
            {filtered.map((p) => {
              const isSelected =
                selectedPlatform?.name?.toLowerCase() === p.name.toLowerCase();
              return (
                <button
                  key={p.id || p.name}
                  onClick={() => {
                    onSelectPlatform(p);
                    setIsOpen(false);
                    setFilter("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-white/20 text-white border border-white/25 shadow-sm font-semibold"
                      : "text-ivory-muted hover:text-white hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <div className="w-5 h-5 rounded-lg bg-black/60 p-0.5 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={p.iconUrl}
                      alt={p.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold truncate ${
                        isSelected ? "text-white" : "text-white/90"
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className="text-[10px] text-ivory-muted/60 truncate font-mono">
                      {p.baseUrl ? p.baseUrl.replace(/^https?:\/\//, "") : ""}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="text-white font-bold text-xs">✓</span>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-xs text-ivory-muted py-4">
                No matching platform
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Watch History ("Continue Watching") Component */
function WatchHistorySection({ history, onSelect, onRemove, onClear }) {
  if (!history || history.length === 0) return null;

  return (
    <section className="watch-history-section animate-fade-in mb-8">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow">YOUR ACTIVITY</p>
          <h2 className="text-xl sm:text-2xl font-bold text-ivory tracking-tight">
            Continue Watching
          </h2>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-ivory-muted hover:text-gold transition-colors font-mono"
        >
          Clear History
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {history.slice(0, 6).map((item) => (
          <div
            key={`${item.platformSlug}-${item.animeSlug}-${item.episodeNum}`}
            className="history-card group relative cursor-pointer rounded-[24px] overflow-hidden"
            onClick={() => onSelect(item)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onSelect(item)}
          >
            {/* Thumbnail */}
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-black/60 rounded-t-[24px]">
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt={item.animeTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <AnimeArtworkIcon className="h-8 w-8 text-ivory-muted/40" />
                </div>
              )}

              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

              {/* Episode Pill */}
              <span className="ep-pill">
                EP {item.episodeNum}
              </span>

              {/* Platform Pill */}
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-black/60 text-white/90 border border-white/10 backdrop-blur-md">
                {item.platformName}
              </span>

              {/* Play Button Icon on Hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/35 backdrop-blur-[2px]">
                <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <span className="ml-0.5 text-sm font-bold">▶</span>
                </div>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-black/80 hover:bg-red-500 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-all z-10 border border-white/15 shadow-md"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
                title="Remove from history"
              >
                ×
              </button>
            </div>

            {/* Title & Info */}
            <div className="p-3 bg-white/5 rounded-b-[24px] border-t border-white/5 backdrop-blur-md">
              <p className="text-xs font-semibold text-white line-clamp-1 group-hover:text-white/80 transition-colors">
                {item.animeTitle}
              </p>
              <p className="text-[10px] text-ivory-muted font-mono mt-0.5 truncate">
                {item.episodeLabel || `Episode ${item.episodeNum}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Home page component (/home) showing Top Picks & Latest from the chosen platform */
function HomeView({
  selectedPlatform,
  popularAnime = [],
  latestAnime = [],
  loading = false,
  error = null,
  selectedAnime = null,
  onSelectAnime,
}) {
  return (
    <div className="home-page animate-fade-in space-y-10 mb-12">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 pt-2 pb-4 border-b border-white/8">
        <div>
          <p className="eyebrow">CHOSEN PLATFORM · {selectedPlatform.name.toUpperCase()}</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Explore {selectedPlatform.name}
          </h1>
          <p className="text-sm text-ivory-muted mt-1">
            Browse top picks and latest releases directly from {selectedPlatform.name}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-white/80 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/15 backdrop-blur-md">
            Source: {selectedPlatform.name}
          </span>
        </div>
      </div>

      {error && (
        <div className="glass p-5 rounded-2xl border border-red-500/20 text-center">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Top Picks Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-gold">★</span> Top Picks
            </h2>
            <p className="text-xs text-ivory-muted mt-0.5">
              Popular titles on {selectedPlatform.name}
            </p>
          </div>
        </div>

        {loading && popularAnime.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : popularAnime.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popularAnime.slice(0, 12).map((item, i) => (
              <AnimeCard
                key={`pop-${item.url || item.link}-${i}`}
                item={item}
                isActive={selectedAnime?.url === item.url}
                onClick={() => onSelectAnime(item)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ivory-muted py-4">No top picks found on {selectedPlatform.name}.</p>
        )}
      </section>

      {/* Latest Releases Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <span className="text-blue-400">⚡</span> Latest Releases
            </h2>
            <p className="text-xs text-ivory-muted mt-0.5">
              Recently updated episodes on {selectedPlatform.name}
            </p>
          </div>
        </div>

        {loading && latestAnime.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : latestAnime.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {latestAnime.slice(0, 18).map((item, i) => (
              <AnimeCard
                key={`lat-${item.url || item.link}-${i}`}
                item={item}
                isActive={selectedAnime?.url === item.url}
                onClick={() => onSelectAnime(item)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-ivory-muted py-4">No recent releases found on {selectedPlatform.name}.</p>
        )}
      </section>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const initialRoute = parsePath(window.location.pathname);
  const initialQuery =
    new URLSearchParams(window.location.search).get("q") || "";

  // ── Platform state ──────────────────────────────────────────────────────────
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
    if (initialRoute.platformSlug) {
      const match = findPlatformBySlug(
        initialRoute.platformSlug,
        DEFAULT_PLATFORMS
      );
      if (match) return match;
    }
    try {
      const saved = localStorage.getItem("animex_platform");
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = DEFAULT_PLATFORMS.find(
          (p) => p.name.toLowerCase() === parsed.name?.toLowerCase()
        );
        if (match) return match;
      }
    } catch (_) {}
    return DEFAULT_PLATFORMS[0]; // Default: AniKoto
  });

  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState(() => {
    if (initialRoute.type === "episode") return "playing";
    if (initialRoute.type === "anime") return "episodes";
    if (initialRoute.type === "home") return "home";
    return "browse";
  });
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);

  // ── Home feed state (/home) ─────────────────────────────────────────────────
  const [homePopular, setHomePopular] = useState([]);
  const [homeLatest, setHomeLatest] = useState([]);
  const [loadingHome, setLoadingHome] = useState(false);
  const [homeError, setHomeError] = useState(null);

  // ── History state ───────────────────────────────────────────────────────────
  const [watchHistory, setWatchHistory] = useState(loadWatchHistory);
  const [searchHistory, setSearchHistory] = useState(loadSearchHistory);
  const lastHistorySave = useRef(0);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(Boolean(initialQuery));

  const [selectedAnime, setSelectedAnime] = useState(null); // { title, url, thumbnail }
  const [episodeData, setEpisodeData] = useState(null); // { episodes: [], totalEpisodes, ... }
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [activeEpisode, setActiveEpisode] = useState(null); // { episode, url }
  const [streamUrl, setStreamUrl] = useState(null); // proxied HLS URL
  const [rawStreamUrl, setRawStreamUrl] = useState(null); // direct/raw upstream stream URL
  const [streams, setStreams] = useState([]); // extracted video streams with proxyUrls
  const [subtitles, setSubtitles] = useState([]); // available subtitle tracks
  const [loadingStream, setLoadingStream] = useState(false);

  // Audio type & server selection state
  const [currentType, setCurrentType] = useState("sub"); // "sub" | "dub"
  const [currentServer, setCurrentServer] = useState(""); // active server name
  const [availableServers, setAvailableServers] = useState({
    sub: [],
    dub: [],
  });
  const [playbackTime, setPlaybackTime] = useState(0);

  // ── Error state ─────────────────────────────────────────────────────────────
  const [error, setError] = useState(null);

  const showError = useCallback((msg) => {
    setError(msg);
    console.error("[AnimeX]", msg);
  }, []);

  // ── Fetch Home Feed (/home) when view is home or platform changes ──────────
  useEffect(() => {
    if (view !== "home") return;
    let cancelled = false;
    setLoadingHome(true);
    setHomeError(null);

    Promise.allSettled([
      api.popular(1, selectedPlatform.name),
      api.latest(1, selectedPlatform.name),
    ]).then(([popRes, latRes]) => {
      if (cancelled) return;
      const pop =
        popRes.status === "fulfilled" ? popRes.value?.items || [] : [];
      const lat =
        latRes.status === "fulfilled" ? latRes.value?.items || [] : [];
      setHomePopular(pop);
      setHomeLatest(lat);
      if (
        pop.length === 0 &&
        lat.length === 0 &&
        popRes.status === "rejected"
      ) {
        setHomeError(
          popRes.reason?.message || "Could not load feed from platform"
        );
      }
      setLoadingHome(false);
    });

    return () => {
      cancelled = true;
    };
  }, [view, selectedPlatform.name]);

  // ── History callbacks ───────────────────────────────────────────────────────
  const recordSearch = useCallback((query) => {
    const updated = saveSearchHistoryEntry(query);
    setSearchHistory(updated);
  }, []);

  const handleRemoveSearch = useCallback((query) => {
    const updated = removeSearchHistoryEntry(query);
    setSearchHistory(updated);
  }, []);

  const handleClearSearchHistory = useCallback(() => {
    clearSearchHistoryStorage();
    setSearchHistory([]);
  }, []);

  const handleRemoveWatchHistory = useCallback((item) => {
    const updated = removeWatchHistoryEntry(item);
    setWatchHistory(updated);
  }, []);

  const handleClearWatchHistory = useCallback(() => {
    clearWatchHistoryStorage();
    setWatchHistory([]);
  }, []);

  const handleTimeUpdate = useCallback(
    (time) => {
      setPlaybackTime(time);
      const now = Date.now();
      if (
        now - lastHistorySave.current > 4000 &&
        selectedAnime &&
        activeEpisode
      ) {
        lastHistorySave.current = now;
        saveWatchHistoryEntry({
          animeTitle: selectedAnime.title,
          animeSlug: toSlug(selectedAnime.title),
          platformName: selectedPlatform.name,
          platformSlug: toSlug(selectedPlatform.name),
          episodeNum: activeEpisode.episode,
          episodeLabel:
            activeEpisode.label || `Episode ${activeEpisode.episode}`,
          episodeUrl: activeEpisode.url,
          animeUrl: selectedAnime.url,
          thumbnail: selectedAnime.thumbnail || "",
          timestamp: now,
          playbackTime: time,
          duration: 0,
        });
      }
    },
    [selectedAnime, activeEpisode, selectedPlatform.name]
  );

  const chooseSuggestion = (item) => {
    setSearchQuery(item.title);
    setDebouncedQuery(item.title);
    setPage(1);
    setView("browse");
    recordSearch(item.title);
    window.history.pushState(
      {},
      "",
      `/?q=${encodeURIComponent(item.title)}`
    );
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    setSearchQuery(query);
    setDebouncedQuery(query);
    setPage(1);
    setView("browse");

    if (query) {
      recordSearch(query);
      window.history.pushState(
        {},
        "",
        `/?q=${encodeURIComponent(query)}`
      );
    } else {
      window.history.pushState({}, "", "/");
    }
  };

  const clearSearchUrl = () => {
    window.history.replaceState({}, "", "/");
  };

  // ── Fetch available platforms on mount ──────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    api
      .platforms()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : data.platforms || [];
        if (list.length > 0) {
          setPlatforms(list);
          setSelectedPlatform((curr) => {
            const updated = list.find(
              (p) => p.name.toLowerCase() === curr.name.toLowerCase()
            );
            return updated || curr;
          });
        }
      })
      .catch((e) => {
        console.warn("[AnimeX] Platforms list load notice:", e.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Switch platform handler ─────────────────────────────────────────────────
  const handleSelectPlatform = useCallback(
    (platform) => {
      if (platform.name === selectedPlatform.name) return;
      setSelectedPlatform(platform);
      try {
        localStorage.setItem("animex_platform", JSON.stringify(platform));
      } catch (_) {}

      const newPlatformSlug = toSlug(platform.name);

      if (selectedAnime) {
        const animeSlug = toSlug(selectedAnime.title);
        if (view === "playing" && activeEpisode) {
          window.history.pushState(
            {},
            "",
            `/${newPlatformSlug}/${animeSlug}/${activeEpisode.episode}`
          );
        } else {
          window.history.pushState({}, "", `/${newPlatformSlug}/${animeSlug}`);
        }
        setEpisodeData(null);
        setActiveEpisode(null);
        setStreamUrl(null);
        setSubtitles([]);
        setPlaybackTime(0);
        setLoadingEpisodes(true);
        api
          .search(selectedAnime.title, 1, platform.name)
          .then((res) => {
            const first = (res.items || [])[0];
            if (first) {
              cacheAnime(newPlatformSlug, animeSlug, first);
              setSelectedAnime(first);
              return api.episodes(first.url, platform.name);
            }
            throw new Error(`Not available on ${platform.name}`);
          })
          .then((data) => {
            setEpisodeData(data);
            setView("episodes");
          })
          .catch((err) => {
            showError(
              `Could not find "${selectedAnime.title}" on ${platform.name}: ${err.message}`
            );
            setView("browse");
          })
          .finally(() => {
            setLoadingEpisodes(false);
          });
        return;
      }

      if (view === "home") {
        window.history.pushState({}, "", "/home");
      } else {
        setView("browse");
        if (!debouncedQuery) {
          window.history.pushState({}, "", "/");
        }
      }
      setSelectedAnime(null);
      setEpisodeData(null);
      setActiveEpisode(null);
      setStreamUrl(null);
      setSubtitles([]);
      setPlaybackTime(0);
    },
    [
      selectedPlatform.name,
      selectedAnime,
      view,
      activeEpisode,
      debouncedQuery,
      showError,
    ]
  );

  // ── Fetch anime list when debouncedQuery, page, or selectedPlatform changes ──
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setAnimeList([]);
      setTotalPages(1);
      setLoadingList(false);
      return undefined;
    }

    let cancelled = false;
    setLoadingList(true);
    setAnimeList([]);

    const platformName = selectedPlatform.name;
    const task = api.search(debouncedQuery, page, platformName);

    task
      .then((data) => {
        if (cancelled) return;
        setAnimeList(data.items || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch((e) => {
        if (!cancelled)
          showError(`Failed to load anime from ${platformName}: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, page, selectedPlatform.name, showError]);

  // ── Resolve anime helper ────────────────────────────────────────────────────
  const resolveAnime = useCallback(
    async (platformSlug, animeSlug, platform) => {
      const cached = getCachedAnime(platformSlug, animeSlug);
      if (cached && cached.url) return cached;

      const history = loadWatchHistory();
      const matchHistory = history.find(
        (h) => h.animeSlug === animeSlug && h.platformSlug === platformSlug
      );
      if (matchHistory && matchHistory.animeUrl) {
        const item = {
          title: matchHistory.animeTitle,
          url: matchHistory.animeUrl,
          thumbnail: matchHistory.thumbnail,
        };
        cacheAnime(platformSlug, animeSlug, item);
        return item;
      }

      try {
        const searchName = animeSlug.replace(/-/g, " ");
        const res = await api.search(searchName, 1, platform.name);
        const first = (res.items || [])[0];
        if (first) {
          cacheAnime(platformSlug, animeSlug, first);
          return first;
        }
      } catch (err) {
        console.warn("[AnimeX] Could not resolve anime:", err);
      }
      return null;
    },
    []
  );

  // ── Select anime → load episodes ────────────────────────────────────────────
  const handleAnimeClick = useCallback(
    async (item, shouldPushUrl = true) => {
      const platformSlug = toSlug(selectedPlatform.name);
      const animeSlug = toSlug(item.title);
      cacheAnime(platformSlug, animeSlug, item);

      if (shouldPushUrl) {
        window.history.pushState({}, "", `/${platformSlug}/${animeSlug}`);
      }

      setSelectedAnime(item);
      setView("episodes");
      setEpisodeData(null);
      setActiveEpisode(null);
      setStreamUrl(null);
      setSubtitles([]);
      setPlaybackTime(0);
      setAvailableServers({ sub: [], dub: [] });
      setCurrentServer("");
      setLoadingEpisodes(true);

      try {
        const data = await api.episodes(item.url, selectedPlatform.name);
        setEpisodeData(data);
        return data;
      } catch (e) {
        showError(
          `Failed to load episodes from ${selectedPlatform.name}: ${e.message}`
        );
        setView("browse");
        return null;
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [selectedPlatform.name, showError]
  );

  // ── Select episode → extract & proxy stream ─────────────────────────────────
  const handleEpisodeClick = useCallback(
    async (
      ep,
      type = currentType,
      server = "",
      linkId = "",
      keepTime = false,
      startTime = 0,
      shouldPushUrl = true,
      currentAnime = null
    ) => {
      const anime = currentAnime || selectedAnime;
      if (anime && shouldPushUrl) {
        const platformSlug = toSlug(selectedPlatform.name);
        const animeSlug = toSlug(anime.title);
        window.history.pushState(
          {},
          "",
          `/${platformSlug}/${animeSlug}/${ep.episode}`
        );
      }

      if (anime) {
        const updated = saveWatchHistoryEntry({
          animeTitle: anime.title,
          animeSlug: toSlug(anime.title),
          platformName: selectedPlatform.name,
          platformSlug: toSlug(selectedPlatform.name),
          episodeNum: ep.episode,
          episodeLabel: ep.label || `Episode ${ep.episode}`,
          episodeUrl: ep.url,
          animeUrl: anime.url,
          thumbnail: anime.thumbnail || "",
          timestamp: Date.now(),
          playbackTime: startTime || 0,
          duration: 0,
        });
        setWatchHistory(updated);
      }

      const isDifferentEpisode = activeEpisode?.url !== ep.url;
      if (!keepTime && isDifferentEpisode) {
        setPlaybackTime(startTime || 0);
      }
      setActiveEpisode(ep);
      setLoadingStream(true);
      setView("playing");

      try {
        const extracted = await api.extract(ep.url, {
          type,
          server,
          linkId,
          platform: selectedPlatform.name,
        });
        if (!extracted || !extracted.streamUrl) {
          throw new Error("No stream found for this episode");
        }
        const proxied = api.proxyHls(extracted.streamUrl);
        setStreamUrl(proxied);
        setRawStreamUrl(extracted.rawStreamUrl || extracted.streamUrl || null);
        const mappedStreams = (extracted.streams || []).map((s) => ({
          ...s,
          proxyUrl: api.proxyHls(s.proxyUrl || s.url),
        }));
        setStreams(mappedStreams);
        setSubtitles(extracted.subtitles || []);
        setCurrentType(extracted.type || type);
        setCurrentServer(extracted.server || server || "");
        if (
          extracted.availableServers &&
          (extracted.availableServers.sub?.length ||
            extracted.availableServers.dub?.length)
        ) {
          setAvailableServers(extracted.availableServers);
        }
      } catch (e) {
        showError(
          `Failed to load stream from ${selectedPlatform.name}: ${e.message}`
        );
        if (isDifferentEpisode) {
          setView("episodes");
          setActiveEpisode(null);
          setSubtitles([]);
          setStreamUrl(null);
          setStreams([]);
        }
      } finally {
        setLoadingStream(false);
      }
    },
    [
      selectedAnime,
      selectedPlatform.name,
      currentType,
      activeEpisode,
      showError,
    ]
  );

  const handleSwitchType = useCallback(
    (newType) => {
      if (newType === currentType || !activeEpisode || loadingStream) return;
      setCurrentType(newType);
      handleEpisodeClick(activeEpisode, newType, "", "", true);
    },
    [currentType, activeEpisode, loadingStream, handleEpisodeClick]
  );

  const handleSwitchServer = useCallback(
    (serverObj) => {
      if (
        serverObj.name.toLowerCase() === currentServer.toLowerCase() ||
        !activeEpisode ||
        loadingStream
      )
        return;
      handleEpisodeClick(
        activeEpisode,
        currentType,
        serverObj.name,
        serverObj.linkId,
        true
      );
    },
    [
      currentServer,
      activeEpisode,
      loadingStream,
      currentType,
      handleEpisodeClick,
    ]
  );


  const handleWatchHistoryClick = useCallback(
    async (historyItem) => {
      const targetPlatform =
        findPlatformBySlug(historyItem.platformSlug, platforms) ||
        selectedPlatform;

      if (targetPlatform.name !== selectedPlatform.name) {
        setSelectedPlatform(targetPlatform);
        try {
          localStorage.setItem(
            "animex_platform",
            JSON.stringify(targetPlatform)
          );
        } catch (_) {}
      }

      const animeObj = {
        title: historyItem.animeTitle,
        url: historyItem.animeUrl,
        thumbnail: historyItem.thumbnail,
      };

      cacheAnime(historyItem.platformSlug, historyItem.animeSlug, animeObj);
      setSelectedAnime(animeObj);
      window.history.pushState(
        {},
        "",
        `/${historyItem.platformSlug}/${historyItem.animeSlug}/${historyItem.episodeNum}`
      );

      setLoadingEpisodes(true);
      try {
        const data = await api.episodes(animeObj.url, targetPlatform.name);
        setEpisodeData(data);
        const matchedEp = (data.episodes || []).find(
          (e) => String(e.episode) === String(historyItem.episodeNum)
        ) || {
          episode: historyItem.episodeNum,
          label: historyItem.episodeLabel,
          url: historyItem.episodeUrl,
        };

        handleEpisodeClick(
          matchedEp,
          "sub",
          "",
          "",
          false,
          historyItem.playbackTime || 0,
          false,
          animeObj
        );
      } catch (err) {
        showError(`Failed to resume: ${err.message}`);
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [platforms, selectedPlatform, handleEpisodeClick, showError]
  );

  // ── Initial mount: resolve deep-linked path ──
  useEffect(() => {
    const route = parsePath(window.location.pathname);
    if (route.type === "landing" || route.type === "home") return;

    let cancelled = false;

    const initDeepLink = async () => {
      let platform = selectedPlatform;
      if (route.platformSlug) {
        const p = findPlatformBySlug(route.platformSlug, DEFAULT_PLATFORMS);
        if (p) {
          platform = p;
          setSelectedPlatform(p);
        }
      }

      if (route.type === "platform") {
        setView("home");
        return;
      }

      if (route.type === "anime" || route.type === "episode") {
        setLoadingEpisodes(true);
        const anime = await resolveAnime(
          route.platformSlug,
          route.animeSlug,
          platform
        );
        if (cancelled) return;
        if (!anime) {
          showError(
            `Could not find anime "${route.animeSlug}" on ${platform.name}`
          );
          setView("browse");
          setLoadingEpisodes(false);
          return;
        }
        setSelectedAnime(anime);

        try {
          const epData = await api.episodes(anime.url, platform.name);
          if (cancelled) return;
          setEpisodeData(epData);

          if (route.type === "anime") {
            setView("episodes");
          } else if (route.type === "episode") {
            const matchedEp = (epData.episodes || []).find(
              (e) => String(e.episode) === String(route.episodeNum)
            ) || epData.episodes?.[0];

            if (matchedEp) {
              handleEpisodeClick(
                matchedEp,
                "sub",
                "",
                "",
                false,
                0,
                false,
                anime
              );
            } else {
              setView("episodes");
            }
          }
        } catch (err) {
          if (!cancelled) {
            showError(`Failed to load episodes: ${err.message}`);
            setView("browse");
          }
        } finally {
          if (!cancelled) setLoadingEpisodes(false);
        }
      }
    };

    initDeepLink();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Handle browser back / forward navigation ──
  useEffect(() => {
    const handlePopState = async () => {
      const route = parsePath(window.location.pathname);
      const q = new URLSearchParams(window.location.search).get("q") || "";

      if (route.type === "home") {
        setView("home");
        setSelectedAnime(null);
        setEpisodeData(null);
        setActiveEpisode(null);
        setStreamUrl(null);
        setSubtitles([]);
        return;
      }

      if (route.type === "landing") {
        setSearchQuery(q);
        setDebouncedQuery(q);
        setPage(1);
        setView("browse");
        setSelectedAnime(null);
        setEpisodeData(null);
        setActiveEpisode(null);
        setStreamUrl(null);
        setSubtitles([]);
        return;
      }

      if (route.type === "platform") {
        const matched = findPlatformBySlug(route.platformSlug, platforms);
        if (matched && matched.name !== selectedPlatform.name) {
          setSelectedPlatform(matched);
        }
        setView("home");
        setSelectedAnime(null);
        setEpisodeData(null);
        setActiveEpisode(null);
        setStreamUrl(null);
        setSubtitles([]);
        return;
      }

      let platformToUse = selectedPlatform;
      const matched = findPlatformBySlug(route.platformSlug, platforms);
      if (matched && matched.name !== selectedPlatform.name) {
        platformToUse = matched;
        setSelectedPlatform(matched);
      }

      if (route.type === "anime") {
        if (selectedAnime && toSlug(selectedAnime.title) === route.animeSlug) {
          setView("episodes");
          setActiveEpisode(null);
          setStreamUrl(null);
          setSubtitles([]);
          return;
        }

        const resolved = await resolveAnime(
          route.platformSlug,
          route.animeSlug,
          platformToUse
        );
        if (resolved) {
          handleAnimeClick(resolved, false);
        }
        return;
      }

      if (route.type === "episode") {
        let anime = selectedAnime;
        if (!anime || toSlug(anime.title) !== route.animeSlug) {
          anime = await resolveAnime(
            route.platformSlug,
            route.animeSlug,
            platformToUse
          );
          if (anime) setSelectedAnime(anime);
        }
        if (!anime) return;

        let epData = episodeData;
        if (!epData) {
          try {
            epData = await api.episodes(anime.url, platformToUse.name);
            setEpisodeData(epData);
          } catch (_) {}
        }

        const matchedEp = (epData?.episodes || []).find(
          (e) => String(e.episode) === String(route.episodeNum)
        ) || {
          episode: route.episodeNum,
          url: anime.url,
        };

        handleEpisodeClick(
          matchedEp,
          "sub",
          "",
          "",
          false,
          0,
          false,
          anime
        );
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    platforms,
    selectedPlatform,
    selectedAnime,
    episodeData,
    resolveAnime,
    handleAnimeClick,
    handleEpisodeClick,
  ]);

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const closePlayer = useCallback(() => {
    setView("episodes");
    setStreamUrl(null);
    setRawStreamUrl(null);
    setStreams([]);
    setSubtitles([]);
    setPlaybackTime(0);
  }, []);

  const goBack = useCallback(() => {
    if (view === "playing") {
      if (selectedAnime) {
        const platformSlug = toSlug(selectedPlatform.name);
        const animeSlug = toSlug(selectedAnime.title);
        window.history.pushState({}, "", `/${platformSlug}/${animeSlug}`);
      }
      closePlayer();
    } else {
      if (debouncedQuery) {
        window.history.pushState(
          {},
          "",
          `/?q=${encodeURIComponent(debouncedQuery)}`
        );
        setView("browse");
      } else {
        window.history.pushState({}, "", "/home");
        setView("home");
      }
      setSelectedAnime(null);
      setEpisodeData(null);
      setStreamUrl(null);
      setRawStreamUrl(null);
      setStreams([]);
      setSubtitles([]);
      setActiveEpisode(null);
      setPlaybackTime(0);
      setAvailableServers({ sub: [], dub: [] });
      setCurrentServer("");
    }
  }, [
    view,
    selectedAnime,
    selectedPlatform.name,
    debouncedQuery,
    closePlayer,
  ]);

  // ── Title for the browser tab ────────────────────────────────────────────────
  useEffect(() => {
    document.title = selectedAnime
      ? `${selectedAnime.title} — ${selectedPlatform.name}`
      : `${selectedPlatform.name} — AnimeX`;
  }, [selectedAnime, selectedPlatform.name]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell min-h-screen flex flex-col">
      {/* ── Navbar ── */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          {/* Header Source Selector (Replaces AnimeX brand and allows switching from top left) */}
          <PlatformSelector
            platforms={platforms}
            selectedPlatform={selectedPlatform}
            onSelectPlatform={handleSelectPlatform}
          />

          {/* Right Header Navigation */}
          <div className="ml-auto flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
            {/* Back breadcrumb */}
            {view === "playing" && (
              <button onClick={goBack} className="ios-back-button">
                <ChevronIcon className="h-4 w-4 rotate-90" />
                <span>Episodes</span>
              </button>
            )}
            {view === "episodes" && (
              <button onClick={goBack} className="ios-back-button">
                <ChevronIcon className="h-4 w-4 rotate-90" />
                <span>Back</span>
              </button>
            )}

            {/* Navigation Tabs (Home / Search) */}
            <nav className="flex items-center bg-black/40 p-1 rounded-full border border-white/10 backdrop-blur-xl">
              <button
                type="button"
                onClick={() => {
                  setView("home");
                  setSelectedAnime(null);
                  setSearchQuery("");
                  setDebouncedQuery("");
                  window.history.pushState({}, "", "/home");
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  view === "home"
                    ? "bg-white text-black shadow-md font-bold"
                    : "text-ivory-muted hover:text-white"
                }`}
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => {
                  setView("browse");
                  setSelectedAnime(null);
                  window.history.pushState(
                    {},
                    "",
                    debouncedQuery
                      ? `/?q=${encodeURIComponent(debouncedQuery)}`
                      : "/"
                  );
                }}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all ${
                  view === "browse"
                    ? "bg-white text-black shadow-md font-bold"
                    : "text-ivory-muted hover:text-white"
                }`}
              >
                Search
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className={`main-content flex-1 max-w-7xl mx-auto w-full px-4 py-6 ${view === "playing" ? "main-playing" : ""}`}>
        {/* ══════ HOME VIEW (/home) ══════ */}
        {view === "home" && (
          <HomeView
            selectedPlatform={selectedPlatform}
            popularAnime={homePopular}
            latestAnime={homeLatest}
            loading={loadingHome}
            error={homeError}
            selectedAnime={selectedAnime}
            onSelectAnime={handleAnimeClick}
          />
        )}

        {/* ══════ BROWSE VIEW ══════ */}
        {view === "browse" && (
          !debouncedQuery ? (
            <>
              <section className="search-home animate-fade-in">
                <div className="search-home-content">
                  <p className="eyebrow">ANIMEX · YOUR ANIME LIBRARY</p>
                  <h1>
                    What are you
                    <br className="sm:hidden" /> in the mood for?
                  </h1>
                  <p className="search-home-copy">
                    Stream seamlessly on {selectedPlatform.name} and across 16+ anime extensions.
                  </p>
                  <SearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    onSubmit={submitSearch}
                    onChoose={chooseSuggestion}
                    platform={selectedPlatform.name}
                  />

                  {/* Search History Chips */}
                  {searchHistory.length > 0 && (
                    <div className="search-history-chips flex items-center justify-center flex-wrap gap-2 mt-4 animate-fade-in">
                      <span className="text-[11px] font-mono text-ivory-muted/70 mr-1">
                        Recent:
                      </span>
                      {searchHistory.map((query) => (
                        <span
                          key={query}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/10 hover:border-gold/40 text-ivory-muted hover:text-ivory transition-all cursor-pointer group"
                          onClick={() => {
                            setSearchQuery(query);
                            setDebouncedQuery(query);
                            setPage(1);
                            setView("browse");
                            window.history.pushState(
                              {},
                              "",
                              `/?q=${encodeURIComponent(query)}`
                            );
                          }}
                        >
                          <span>{query}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSearch(query);
                            }}
                            className="text-ivory-muted/60 hover:text-white ml-0.5 text-sm leading-none"
                            title="Remove"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={handleClearSearchHistory}
                        className="text-[11px] text-ivory-muted/60 hover:text-gold font-mono ml-1 underline transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  <p className="search-hint">Search results can be shared with a link.</p>
                </div>
              </section>

              {/* Watch History ("Continue Watching") */}
              <WatchHistorySection
                history={watchHistory}
                onSelect={handleWatchHistoryClick}
                onRemove={handleRemoveWatchHistory}
                onClear={handleClearWatchHistory}
              />
            </>
          ) : (
          <div className="animate-fade-in">
            <div className="results-search">
              <SearchBar
                value={searchQuery}
                onChange={setSearchQuery}
                onSubmit={submitSearch}
                onChoose={chooseSuggestion}
                platform={selectedPlatform.name}
              />
            </div>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
              <h1 className="section-title mb-0">
                Results for <span className="result-query">“{debouncedQuery}”</span>
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ivory-muted font-mono">
                  Source: <strong className="text-gold">{selectedPlatform.name}</strong>
                </span>
              </div>
            </div>

            {loadingList ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : animeList.length === 0 ? (
              <div className="glass p-12 text-center animate-fade-in">
                <SearchIcon className="mx-auto mb-4 h-10 w-10 text-ivory-muted" />
                <p className="text-ivory font-semibold text-lg">
                  No results found on {selectedPlatform.name}
                </p>
                <p className="text-ivory-muted text-sm mt-1">
                  Try another search query or switch to another platform from the top right.
                </p>
                {debouncedQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setDebouncedQuery("");
                      clearSearchUrl();
                    }}
                    className="btn-gold mt-4"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-slide-up">
                  {animeList.map((item, i) => (
                    <AnimeCard
                      key={`${item.url || item.link}-${i}`}
                      item={item}
                      isActive={selectedAnime?.url === item.url}
                      onClick={() => handleAnimeClick(item)}
                    />
                  ))}
                </div>

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPrev={() => setPage((p) => Math.max(1, p - 1))}
                  onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                />
              </>
            )}
          </div>
          )
        )}

        {/* ══════ EPISODES VIEW ══════ */}
        {(view === "episodes" || view === "playing") && selectedAnime && (
          <div className={`animate-fade-in ${view === "playing" ? "playing-layout" : ""}`}>
            {/* ── Player (shown when streaming) ── */}
            {view === "playing" && (
              <div className="player-stage mb-6">
                {loadingStream && !streamUrl ? (
                  <div className="player-wrapper flex items-center justify-center min-h-[320px]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full border-3 border-white/15 border-t-white animate-spin" />
                      <p className="text-ivory-muted text-sm">
                        Extracting stream from {selectedPlatform.name}…
                      </p>
                    </div>
                  </div>
                ) : streamUrl ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <Player
                        streamUrl={streamUrl}
                        rawStreamUrl={rawStreamUrl}
                        downloadUrl={streamUrl}
                        streams={streams}
                        availableServers={availableServers}
                        currentType={currentType}
                        subtitles={subtitles}
                        initialTime={playbackTime}
                        onTimeUpdate={handleTimeUpdate}
                        title={
                          activeEpisode
                            ? `${selectedAnime.title} · EP ${activeEpisode.episode}`
                            : selectedAnime.title
                        }
                        onClose={closePlayer}
                        onError={showError}
                      />
                      {loadingStream && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-30 rounded-[28px]">
                          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/80 border border-white/15 backdrop-blur-2xl shadow-2xl">
                            <div className="w-4 h-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                            <span className="text-xs font-semibold text-white">
                              Switching stream…
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Sub/Dub & Server Controls ── */}
                    {(availableServers.sub?.length > 0 ||
                      availableServers.dub?.length > 0) && (
                      <div className="glass rounded-[24px] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 animate-fade-in border border-white/12">
                        {/* Audio Type Toggle (SUB / DUB) */}
                        <div className="flex items-center gap-2.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-muted/70">
                            Audio:
                          </span>
                          <div className="flex items-center bg-black/60 p-1 rounded-full border border-white/12 backdrop-blur-xl">
                            <button
                              onClick={() => handleSwitchType("sub")}
                              disabled={
                                loadingStream ||
                                availableServers.sub?.length === 0
                              }
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                                currentType === "sub"
                                  ? "bg-white text-black shadow-md"
                                  : availableServers.sub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-white"
                              }`}
                            >
                              SUB{" "}
                              {availableServers.sub?.length > 0
                                ? `(${availableServers.sub.length})`
                                : ""}
                            </button>
                            <button
                              onClick={() => handleSwitchType("dub")}
                              disabled={
                                loadingStream ||
                                availableServers.dub?.length === 0
                              }
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all ${
                                currentType === "dub"
                                  ? "bg-white text-black shadow-md"
                                  : availableServers.dub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-white"
                              }`}
                            >
                              DUB{" "}
                              {availableServers.dub?.length > 0
                                ? `(${availableServers.dub.length})`
                                : ""}
                            </button>
                          </div>
                        </div>

                        {/* Server Switcher */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-muted/70">
                            Server:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(
                              (currentType === "dub"
                                ? availableServers.dub
                                : availableServers.sub) || []
                            ).map((srv) => {
                              const isSelected =
                                currentServer.toLowerCase() ===
                                srv.name.toLowerCase();
                              return (
                                <button
                                  key={srv.linkId || srv.name}
                                  onClick={() => handleSwitchServer(srv)}
                                  disabled={loadingStream || isSelected}
                                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                                    isSelected
                                      ? "bg-white text-black border-white shadow-md font-semibold"
                                      : "bg-white/8 text-ivory-muted border-white/10 hover:border-white/20 hover:text-white hover:bg-white/12"
                                  }`}
                                >
                                  {isSelected ? "● " : ""}
                                  {srv.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Episode Grid Inline (directly below server switcher) ── */}
                    <EpisodeGrid
                      episodes={episodeData?.episodes || []}
                      activeEpisode={activeEpisode}
                      onSelectEpisode={handleEpisodeClick}
                      loading={loadingEpisodes}
                      platformName={selectedPlatform.name}
                    />
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Anime info header ── */}
            <div className="anime-info-header glass rounded-[28px] p-6 mb-6 flex gap-5 items-start border border-white/12">
              {/* Thumbnail */}
              {selectedAnime.thumbnail && (
                <img
                  src={selectedAnime.thumbnail}
                  alt={selectedAnime.title}
                  className="w-24 h-34 object-cover rounded-2xl flex-shrink-0 ring-1 ring-white/15 shadow-2xl"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-white leading-tight">
                    {selectedAnime.title}
                  </h2>
                  <span className="tag text-[10px]">
                    {selectedPlatform.name}
                  </span>
                </div>
                {episodeData?.description && (
                  <p className="text-ivory-muted text-sm leading-relaxed line-clamp-3 mt-2">
                    {episodeData.description}
                  </p>
                )}
                {episodeData && (
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="tag">
                      {episodeData.totalEpisodes} Episodes
                    </span>
                    {episodeData.genres?.map((g) => (
                      <span
                        key={g}
                        className="tag bg-white/5 text-ivory-muted border-white/10 text-[10px]"
                      >
                        {g}
                      </span>
                    ))}
                    {activeEpisode && (
                      <span className="tag bg-white/20 text-white border-white/30 backdrop-blur-md">
                        ▶ EP {activeEpisode.episode}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Episode Grid (when viewing anime details before playing) ── */}
            {view === "episodes" && (
              <EpisodeGrid
                episodes={episodeData?.episodes || []}
                activeEpisode={activeEpisode}
                onSelectEpisode={handleEpisodeClick}
                loading={loadingEpisodes}
                platformName={selectedPlatform.name}
              />
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 text-ivory-muted text-xs">
            <span>AnimeX · Multi-Platform Streaming</span>
            <span>·</span>
            <span className="text-gold font-semibold">{selectedPlatform.name}</span>
          </div>
          <p className="text-ivory-muted/50 text-xs font-mono">
            {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* ── Error toast ── */}
      {error && (
        <ErrorToast message={error} onDismiss={() => setError(null)} />
      )}
    </div>
  );
}
