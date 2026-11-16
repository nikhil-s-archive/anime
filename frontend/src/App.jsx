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
      className="rounded-xl overflow-hidden"
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
        <div className="absolute inset-0 ring-2 ring-gold rounded-xl pointer-events-none" />
      )}
    </article>
  );
}

/** Episode list row */
function EpisodeRow({ ep, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3
                  transition-all duration-150 group
                  ${
                    isActive
                      ? "bg-gold/20 border border-gold/40"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${
                      isActive
                        ? "bg-gold text-navy"
                        : "bg-navy-800/60 text-gold group-hover:bg-azure/40"
                    }`}
      >
        {ep.episode}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span
          className={`text-sm font-medium truncate ${
            isActive ? "text-ivory" : "text-ivory-muted"
          }`}
        >
          {ep.label || `Episode ${ep.episode}`}
        </span>
        {ep.badge && (
          <span className="text-[10px] font-mono text-gold/70 mt-0.5">
            {ep.badge}
          </span>
        )}
      </div>
      {isActive && (
        <span className="ml-auto text-gold text-xs font-semibold flex-shrink-0">
          ▶ Now Playing
        </span>
      )}
    </button>
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
                 glass px-5 py-3 flex items-center gap-3 max-w-sm w-full"
      role="alert"
    >
      <WarningIcon className="h-5 w-5 flex-shrink-0 text-red-400" />
      <p className="text-ivory-muted text-sm flex-1">{message}</p>
      <button
        onClick={onDismiss}
        className="text-ivory-muted hover:text-ivory transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Platform Selector Component on Top Right
 * Displays the selected platform's logo and name, and allows picking any platform
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
      {/* ── Top-Right Platform Button (Logo + Name) ── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-gold/30 bg-navy-800/80 hover:bg-azure/50 hover:border-gold/60 transition-all duration-200 shadow-sm group"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Selected Platform: ${selectedPlatform?.name || "Select Platform"}`}
      >
        {/* Platform Logo */}
        <div className="w-6 h-6 rounded-md overflow-hidden bg-navy-900 flex items-center justify-center border border-white/10 flex-shrink-0 p-0.5">
          {!logoError && selectedPlatform?.iconUrl ? (
            <img
              src={selectedPlatform.iconUrl}
              alt={selectedPlatform.name}
              className="w-full h-full object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <DisplayIcon className="h-4 w-4 text-ivory-muted" />
          )}
        </div>

        {/* Platform Name on Top Right */}
        <div className="flex flex-col text-left leading-none">
          <span className="text-[9px] uppercase tracking-wider text-gold/80 font-mono font-bold">
            Source
          </span>
          <span className="text-sm font-bold text-ivory tracking-tight truncate max-w-[100px] sm:max-w-[140px] group-hover:text-gold transition-colors">
            {selectedPlatform?.name || "AniKoto"}
          </span>
        </div>

        {/* Dropdown Chevron */}
        <span
          className={`text-[10px] text-gold/80 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>

      {/* ── Dropdown Menu ── */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl glass p-2.5 z-50 shadow-2xl border border-gold/40 animate-slide-up backdrop-blur-2xl">
          {/* Header & Search */}
          <div className="p-1 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-ivory">Select Platform</span>
              <span className="text-[10px] font-mono text-gold bg-gold/15 px-2 py-0.5 rounded-full border border-gold/25">
                {platforms.length} platforms
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ivory-muted/60 pointer-events-none">
                <SearchIcon className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                placeholder="Search platforms..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full bg-navy-900/90 border border-white/10 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-ivory placeholder-ivory-muted/60 outline-none focus:border-gold/50"
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
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-all ${
                    isSelected
                      ? "bg-gold/20 text-ivory border border-gold/40 shadow-sm"
                      : "text-ivory-muted hover:text-ivory hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="w-5 h-5 rounded bg-navy-900/80 p-0.5 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
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
                        isSelected ? "text-gold" : "text-ivory"
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className="text-[10px] text-ivory-muted/60 truncate font-mono">
                      {p.baseUrl ? p.baseUrl.replace(/^https?:\/\//, "") : ""}
                    </p>
                  </div>
                  {isSelected && (
                    <span className="text-gold font-bold text-xs">✓</span>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── Platform state ──────────────────────────────────────────────────────────
  const [platforms, setPlatforms] = useState(DEFAULT_PLATFORMS);
  const [selectedPlatform, setSelectedPlatform] = useState(() => {
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
  const initialQuery = new URLSearchParams(window.location.search).get("q") || "";
  const [view, setView] = useState("browse"); // "browse" | "episodes" | "playing"
  const [episodesSheetOpen, setEpisodesSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const episodeSheetTouchStartY = useRef(null);
  const episodeSheetIgnoreClickUntil = useRef(0);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(Boolean(initialQuery));
  const [popularAnime, setPopularAnime] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [popularError, setPopularError] = useState("");

  const [selectedAnime, setSelectedAnime] = useState(null); // { title, url, thumbnail }
  const [episodeData, setEpisodeData] = useState(null); // { episodes: [], totalEpisodes, ... }
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [activeEpisode, setActiveEpisode] = useState(null); // { episode, url }
  const [streamUrl, setStreamUrl] = useState(null); // proxied HLS URL
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

  const handleEpisodeSheetTouchStart = (event) => {
    episodeSheetTouchStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleEpisodeSheetTouchEnd = (event) => {
    const startY = episodeSheetTouchStartY.current;
    episodeSheetTouchStartY.current = null;
    if (startY === null) return;

    const distance = event.changedTouches[0].clientY - startY;
    if (Math.abs(distance) < 40) return;
    episodeSheetIgnoreClickUntil.current = Date.now() + 500;
    if (distance < 0) setEpisodesSheetOpen(true);
    else setEpisodesSheetOpen(false);
  };

  const toggleEpisodesSheet = () => {
    if (Date.now() < episodeSheetIgnoreClickUntil.current) return;
    setEpisodesSheetOpen((open) => !open);
  };

  const chooseSuggestion = (item) => {
    setSearchQuery(item.title);
    setDebouncedQuery(item.title);
    setPage(1);
    setView("browse");
    const url = new URL(window.location.href);
    url.searchParams.set("q", item.title);
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const query = searchQuery.trim();
    setSearchQuery(query);
    setDebouncedQuery(query);
    setPage(1);
    setView("browse");

    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const clearSearchUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    const syncSearchFromUrl = () => {
      const query = new URLSearchParams(window.location.search).get("q") || "";
      setSearchQuery(query);
      setDebouncedQuery(query);
      setPage(1);
      setView("browse");
    };
    window.addEventListener("popstate", syncSearchFromUrl);
    return () => window.removeEventListener("popstate", syncSearchFromUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingPopular(true);
    setPopularError("");
    api
      .popular(1, selectedPlatform.name)
      .then((data) => {
        if (!cancelled) setPopularAnime((data.items || []).slice(0, 6));
      })
      .catch((e) => {
        if (!cancelled) setPopularError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPopular(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPlatform.name]);

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
          // If current selectedPlatform is in list, sync details
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

      // Reset state to browse newly selected platform
      setView("browse");
      setSelectedAnime(null);
      setEpisodeData(null);
      setActiveEpisode(null);
      setStreamUrl(null);
      setSubtitles([]);
      setPlaybackTime(0);
      setSearchQuery("");
      setDebouncedQuery("");
      setPage(1);
      clearSearchUrl();
      setEpisodesSheetOpen(false);
    },
    [selectedPlatform.name]
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

  // ── Select anime → load episodes ────────────────────────────────────────────
  const handleAnimeClick = useCallback(
    async (item) => {
      if (selectedAnime?.url === item.url && view === "episodes") return;
      setSelectedAnime(item);
      setView("episodes");
      setEpisodeData(null);
      setActiveEpisode(null);
      setStreamUrl(null);
      setSubtitles([]);
      setPlaybackTime(0);
      setAvailableServers({ sub: [], dub: [] });
      setCurrentServer("");
      setEpisodesSheetOpen(false);
      setLoadingEpisodes(true);

      try {
        const data = await api.episodes(item.url, selectedPlatform.name);
        setEpisodeData(data);
      } catch (e) {
        showError(
          `Failed to load episodes from ${selectedPlatform.name}: ${e.message}`
        );
        setView("browse");
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [selectedAnime, view, selectedPlatform.name, showError]
  );

  // ── Select episode → extract & proxy stream ─────────────────────────────────
  const handleEpisodeClick = useCallback(
    async (
      ep,
      type = currentType,
      server = "",
      linkId = "",
      keepTime = false
    ) => {
      const isDifferentEpisode = activeEpisode?.url !== ep.url;
      if (!keepTime && isDifferentEpisode) {
        setPlaybackTime(0);
      }
      setActiveEpisode(ep);
      setEpisodesSheetOpen(false);
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
        }
      } finally {
        setLoadingStream(false);
      }
    },
    [activeEpisode, currentType, selectedPlatform.name, showError]
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

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (view === "playing") {
      setView("episodes");
      setEpisodesSheetOpen(false);
      setStreamUrl(null);
      setSubtitles([]);
      setPlaybackTime(0);
    } else {
      setView("browse");
      setSelectedAnime(null);
      setEpisodeData(null);
      setStreamUrl(null);
      setSubtitles([]);
      setActiveEpisode(null);
      setPlaybackTime(0);
      setAvailableServers({ sub: [], dub: [] });
      setCurrentServer("");
    }
  }, [view]);

  const closePlayer = useCallback(() => {
    setView("episodes");
    setEpisodesSheetOpen(false);
    setStreamUrl(null);
    setSubtitles([]);
    setPlaybackTime(0);
  }, []);

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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          {/* Top-Left Brand Logo (matches selected platform with AnimeX brand) */}
          <button
            onClick={() => {
              setView("browse");
              setSelectedAnime(null);
              setSearchQuery("");
              setDebouncedQuery("");
              clearSearchUrl();
              setEpisodesSheetOpen(false);
            }}
            className="flex items-center gap-2.5 flex-shrink-0 group"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-navy-800 border border-gold/30 flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform">
              {selectedPlatform?.iconUrl ? (
                <img
                  src={selectedPlatform.iconUrl}
                  alt={selectedPlatform.name}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <AnimeArtworkIcon className="h-5 w-5 text-ivory-muted" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-gradient-gold font-extrabold text-lg tracking-tight leading-none">
                AnimeX
              </span>
              <span className="text-[10px] text-ivory-muted/70 font-mono leading-none mt-0.5">
                {selectedPlatform?.name || "Anime"}
              </span>
            </div>
          </button>

          {/* Back breadcrumb */}
          {view === "playing" && (
            <button onClick={goBack} className="ios-back-button hidden sm:inline-flex">
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

          {/* Anime title in episodes/playing view */}
          {view !== "browse" && selectedAnime && (
            <div className="flex-1 ml-2 min-w-0">
              <p className="text-ivory font-semibold text-sm truncate">
                {selectedAnime.title}
              </p>
              {episodeData && (
                <p className="text-gold text-xs font-mono truncate">
                  {episodeData.totalEpisodes} episodes · {selectedPlatform.name}
                </p>
              )}
            </div>
          )}

          {/* ── Top-Right Platform Selector (Logo + Name) ── */}
          <div className="ml-auto flex-shrink-0">
            <PlatformSelector
              platforms={platforms}
              selectedPlatform={selectedPlatform}
              onSelectPlatform={handleSelectPlatform}
            />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className={`main-content flex-1 max-w-7xl mx-auto w-full px-4 py-6 ${view === "playing" ? "main-playing" : ""}`}>
        {/* ══════ BROWSE VIEW ══════ */}
        {view === "browse" && (
          !debouncedQuery ? (
            <>
              <section className="search-home animate-fade-in">
                <div className="search-home-content">
                <p className="eyebrow">ANIMEX · YOUR ANIME LIBRARY</p>
                <h1>What are you<br className="sm:hidden" /> in the mood for?</h1>
                <p className="search-home-copy">
                  Find your next favorite on {selectedPlatform.name}.
                </p>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSubmit={submitSearch}
                  onChoose={chooseSuggestion}
                  platform={selectedPlatform.name}
                />
                <p className="search-hint">Search results can be shared with a link.</p>
              </div>
              </section>
              <section className="home-recommendations animate-fade-in">
                <div className="recommendations-heading">
                  <div>
                    <p className="eyebrow">PICKED FOR YOU</p>
                    <h2>Popular anime</h2>
                  </div>
                  <span>{selectedPlatform.name}</span>
                </div>
                {loadingPopular ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <SkeletonCard key={index} />
                    ))}
                  </div>
                ) : popularAnime.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {popularAnime.map((item, index) => (
                      <AnimeCard
                        key={`${item.url || item.link}-${index}`}
                        item={item}
                        isActive={selectedAnime?.url === item.url}
                        onClick={() => handleAnimeClick(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="recommendations-empty" role="status">
                    {popularError
                      ? `Popular anime could not be loaded: ${popularError}`
                      : `No popular anime available from ${selectedPlatform.name} right now.`}
                  </div>
                )}
              </section>
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
                      <div className="w-12 h-12 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
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
                        subtitles={subtitles}
                        initialTime={playbackTime}
                        onTimeUpdate={(t) => setPlaybackTime(t)}
                        title={
                          activeEpisode
                            ? `${selectedAnime.title} · EP ${activeEpisode.episode}`
                            : selectedAnime.title
                        }
                        onClose={closePlayer}
                        onError={showError}
                      />
                      {loadingStream && (
                        <div className="absolute inset-0 bg-navy/60 backdrop-blur-sm flex items-center justify-center z-30 rounded-2xl">
                          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-navy-800/90 border border-gold/30">
                            <div className="w-5 h-5 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
                            <span className="text-xs font-semibold text-ivory">
                              Switching stream…
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Sub/Dub & Server Controls ── */}
                    {(availableServers.sub?.length > 0 ||
                      availableServers.dub?.length > 0) && (
                      <div className="glass px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                        {/* Audio Type Toggle (SUB / DUB) */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-muted/70">
                            Audio:
                          </span>
                          <div className="flex items-center bg-navy-900/80 p-0.5 rounded-lg border border-white/10">
                            <button
                              onClick={() => handleSwitchType("sub")}
                              disabled={
                                loadingStream ||
                                availableServers.sub?.length === 0
                              }
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                currentType === "sub"
                                  ? "bg-gold text-navy shadow-sm"
                                  : availableServers.sub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-ivory"
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
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                currentType === "dub"
                                  ? "bg-gold text-navy shadow-sm"
                                  : availableServers.dub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-ivory"
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
                                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                                    isSelected
                                      ? "bg-azure text-ivory border-gold/50 shadow-sm font-semibold"
                                      : "bg-navy-800/60 text-ivory-muted border-white/10 hover:border-white/20 hover:text-ivory"
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
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Anime info header ── */}
            <div className="anime-info-header glass p-5 mb-6 flex gap-5 items-start">
              {/* Thumbnail */}
              {selectedAnime.thumbnail && (
                <img
                  src={selectedAnime.thumbnail}
                  alt={selectedAnime.title}
                  className="w-20 h-28 object-cover rounded-xl flex-shrink-0 ring-1 ring-gold/20"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-ivory leading-tight">
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
                      <span className="tag bg-gold/20 text-gold border-gold/30">
                        ▶ EP {activeEpisode.episode}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <section
              className={`episode-sheet ${
                view === "playing" ? "is-playing" : ""
              } ${episodesSheetOpen ? "is-expanded" : ""}`}
            >
              <div
                className="episode-sheet-handle"
                onTouchStart={handleEpisodeSheetTouchStart}
                onTouchEnd={handleEpisodeSheetTouchEnd}
              >
                <span className="episode-sheet-grabber" />
                <button
                  type="button"
                  className="episode-sheet-toggle"
                  onClick={toggleEpisodesSheet}
                  aria-expanded={episodesSheetOpen}
                  aria-label={
                    episodesSheetOpen ? "Collapse episode list" : "Show episode list"
                  }
                >
                  <span className="episode-sheet-heading">
                    <span>Episodes</span>
                    <span className="episode-sheet-count">
                      {episodeData?.totalEpisodes ??
                        episodeData?.episodes?.length ??
                        0}
                    </span>
                  </span>
                  <ChevronIcon
                    className={`h-5 w-5 transition-transform ${
                      episodesSheetOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>
              <div className="episode-sheet-body">
                <h3 className="section-title episode-list-title">Episodes</h3>

                {loadingEpisodes ? (
                  <div className="space-y-2">
                    {Array.from({ length: 12 }).map((_, i) => (
                      <div key={i} className="skeleton h-14 rounded-xl" />
                    ))}
                  </div>
                ) : episodeData?.episodes?.length ? (
                  <div className="episode-list-rows space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
                    {episodeData.episodes.map((ep) => (
                      <EpisodeRow
                        key={ep.url}
                        ep={ep}
                        isActive={activeEpisode?.url === ep.url}
                        onClick={() => handleEpisodeClick(ep)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="glass p-10 text-center">
                    <p className="text-ivory-muted">
                      No episodes found on {selectedPlatform.name} for this title.
                    </p>
                  </div>
                )}
              </div>
            </section>
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
