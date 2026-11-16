/**
 * App.jsx — AnimeX Apple TV Theme & Multi-Platform Streaming
 *
 * Requirements:
 *   - Apple TV-inspired dark aesthetic (deep black, refined typography, sleek frosted glass)
 *   - Mobile responsive layout
 *   - URL query parameter search (?q=search_query) instead of giant home search landing page
 *   - Home page displays rich Apple TV catalog (Featured Hero Spotlight, Latest/Popular tabs, Grid)
 *   - Liquid Glass UI Video Player integration
 *   - Multi-platform support (all 17 Mangayomi extension sources with dynamic logo/name on top right)
 *   - Zero purple gradients
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Player from "./components/Player.jsx";

// ─── Config & Constants ───────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE || "";

const DEFAULT_PLATFORMS = [
  {
    name: "AniKoto",
    id: 1356478902,
    baseUrl: "https://anikototv.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://anikototv.to",
  },
  {
    name: "ReAnime",
    id: 631942785,
    baseUrl: "https://reanime.cz",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://reanime.cz",
  },
  {
    name: "Senshi",
    id: 728461935,
    baseUrl: "https://senshi.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://senshi.to",
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
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://all-wish.me",
  },
  {
    name: "JustAnime",
    id: 892345671,
    baseUrl: "https://justanime.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://justanime.to",
  },
  {
    name: "HiAnime",
    id: 1183439094,
    baseUrl: "https://hianime.at",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://hianime.at",
  },
  {
    name: "AnimeParadise",
    id: 419768715,
    baseUrl: "https://animeparadise.moe",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=128&domain=https://animeparadise.moe",
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
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://anidap.lol",
  },
  {
    name: "Miruro",
    id: 617345892,
    baseUrl: "https://miruro.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://miruro.to",
  },
  {
    name: "AniWave",
    id: -367725331,
    baseUrl: "https://aniwaves.ru",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://aniwaves.ru",
  },
  {
    name: "1Anime",
    id: 384756102,
    baseUrl: "https://1anime.app",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://1anime.app",
  },
  {
    name: "AnimeHeaven",
    id: -1744325818,
    baseUrl: "https://animeheaven.me",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://animeheaven.me",
  },
  {
    name: "Anichi",
    id: 878498226,
    baseUrl: "https://anichi.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://anichi.to",
  },
  {
    name: "AnimeKai",
    id: 232158530,
    baseUrl: "https://animekaitv.to",
    lang: "en",
    iconUrl: "https://www.google.com/s2/favicons?sz=256&domain=https://animekaitv.to",
  },
];

// ─── API Client ───────────────────────────────────────────────────────────────

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
    apiFetch(`/api/latest?page=${page}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`),
  popular: (page = 1, platform = "") =>
    apiFetch(`/api/popular?page=${page}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`),
  search: (q, page = 1, platform = "") =>
    apiFetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`),
  episodes: (url, platform = "") =>
    apiFetch(`/api/episodes?url=${encodeURIComponent(url)}${platform ? `&platform=${encodeURIComponent(platform)}` : ""}`),
  extract: (url, opts = {}) => {
    const params = new URLSearchParams();
    if (url) params.set("url", url);
    if (opts.type) params.set("type", opts.type);
    if (opts.server) params.set("server", opts.server);
    if (opts.linkId) params.set("linkId", opts.linkId);
    if (opts.platform) params.set("platform", opts.platform);
    return apiFetch(`/api/extract?${params.toString()}`);
  },
  proxyHls: (streamUrl) => {
    if (!streamUrl) return "";
    if (streamUrl.includes("/proxy/hls?url=")) {
      if (streamUrl.startsWith("http")) return streamUrl;
      return `${API_BASE}${streamUrl}`;
    }
    return `${API_BASE}/proxy/hls?url=${encodeURIComponent(streamUrl)}`;
  },
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────

const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const PlayMiniIcon = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// ─── Platform Selector Component ──────────────────────────────────────────────

function PlatformSelector({ platforms, selectedPlatform, onSelectPlatform }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [logoError, setLogoError] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return platforms;
    return platforms.filter((p) =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    );
  }, [platforms, filter]);

  return (
    <div className="relative" ref={ref}>
      {/* Top Right Selector Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="liquidGlass-wrapper px-3 py-1.5 h-10 border border-white/15 gap-2.5 max-w-[160px] sm:max-w-[210px]"
        title={`Selected Platform: ${selectedPlatform?.name || "AniKoto"}`}
      >
        <div className="liquidGlass-effect" />
        <div className="liquidGlass-shine" />
        <div className="liquidGlass-constant" />
        <div className="liquidGlass-text flex items-center gap-2">
          {/* Logo icon */}
          <div className="w-5 h-5 rounded-full overflow-hidden bg-black/60 flex items-center justify-center border border-white/20 flex-shrink-0">
            {!logoError && selectedPlatform?.iconUrl ? (
              <img
                src={selectedPlatform.iconUrl}
                alt=""
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {selectedPlatform?.name?.charAt(0) || "A"}
              </span>
            )}
          </div>

          {/* Name */}
          <div className="flex flex-col text-left leading-none min-w-0">
            <span className="text-[9px] uppercase tracking-wider text-white/50 font-bold hidden sm:block">
              Platform
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[70px] sm:max-w-[110px]">
              {selectedPlatform?.name || "AniKoto"}
            </span>
          </div>

          {/* Chevron */}
          <ChevronDownIcon
            className={`w-3.5 h-3.5 text-white/60 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      {/* Flyout Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 sm:w-72 rounded-2xl bg-black/80 backdrop-blur-2xl border border-white/20 p-2.5 z-50 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-xs font-semibold text-white/70">Switch Platform</span>
            <span className="text-[10px] font-mono text-white/50 bg-white/10 px-2 py-0.5 rounded-full">
              {platforms.length} sources
            </span>
          </div>

          {/* Search input */}
          <div className="relative mb-2">
            <input
              type="text"
              placeholder="Filter platform..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:border-white/40"
              autoFocus
            />
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto space-y-1 no-scrollbar">
            {filtered.map((p) => {
              const isSelected = selectedPlatform?.name?.toLowerCase() === p.name.toLowerCase();
              return (
                <button
                  key={p.id || p.name}
                  onClick={() => {
                    onSelectPlatform(p);
                    setIsOpen(false);
                    setFilter("");
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-colors ${
                    isSelected
                      ? "bg-white/20 text-white font-semibold border border-white/30"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-black/50 p-0.5 border border-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={p.iconUrl}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-[10px] text-white/40 truncate font-mono">
                      {p.baseUrl ? p.baseUrl.replace(/^https?:\/\//, "") : ""}
                    </p>
                  </div>
                  {isSelected && <span className="text-white text-xs">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Apple TV Anime Card ──────────────────────────────────────────────────────

function AnimeCard({ item, onClick }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      className="apple-card group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      {/* Background Image */}
      {!imgError && item.thumbnail ? (
        <img
          src={item.thumbnail}
          alt={item.title}
          loading="lazy"
          className={`w-full h-full object-cover transition-all duration-300 ${
            imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"
          }`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-zinc-900 text-white/40">
          <span className="text-2xl mb-1">🎬</span>
          <span className="text-xs line-clamp-2">{item.title}</span>
        </div>
      )}

      {/* Episode / Status badge on top right */}
      {item.episodeLabel && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 backdrop-blur-md text-white border border-white/20">
          {item.episodeLabel}
        </div>
      )}

      {/* Bottom gradient and title */}
      <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black via-black/70 to-transparent flex flex-col justify-end">
        <h4 className="text-xs sm:text-sm font-semibold text-white line-clamp-2 leading-snug group-hover:text-white">
          {item.title}
        </h4>
      </div>
    </div>
  );
}

// ─── Main Application ─────────────────────────────────────────────────────────

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
    return DEFAULT_PLATFORMS[0];
  });

  // ── URL Search Synchronization (?q=search_query) ────────────────────────────
  const getUrlQuery = () => new URLSearchParams(window.location.search).get("q") || "";
  const [searchParam, setSearchParam] = useState(getUrlQuery);
  const [searchInput, setSearchInput] = useState(getUrlQuery);

  // Sync with browser forward/back buttons
  useEffect(() => {
    const handlePopState = () => {
      const query = getUrlQuery();
      setSearchParam(query);
      setSearchInput(query);
      if (!query) {
        setView("browse");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const updateSearchUrl = (query) => {
    const trimmed = query.trim();
    const url = new URL(window.location.href);
    if (trimmed) {
      url.searchParams.set("q", trimmed);
    } else {
      url.searchParams.delete("q");
    }
    window.history.pushState({}, "", `${url.pathname}${url.search}${url.hash}`);
    setSearchParam(trimmed);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    updateSearchUrl(searchInput);
    setView("browse");
  };

  const handleClearSearch = () => {
    setSearchInput("");
    updateSearchUrl("");
    setView("browse");
  };

  // ── Navigation & Views ──────────────────────────────────────────────────────
  const [view, setView] = useState("browse"); // "browse" | "episodes" | "playing"
  const [homeTab, setHomeTab] = useState("latest"); // "latest" | "popular"

  // ── Catalog Data ───────────────────────────────────────────────────────────
  const [catalogList, setCatalogList] = useState([]);
  const [catalogPage, setCatalogPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  // ── Featured Anime (for Apple TV Hero Spotlight) ────────────────────────────
  const [featuredAnime, setFeaturedAnime] = useState(null);

  // ── Selected Anime & Playback ───────────────────────────────────────────────
  const [selectedAnime, setSelectedAnime] = useState(null);
  const [episodeData, setEpisodeData] = useState(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [loadingStream, setLoadingStream] = useState(false);
  const [availableServers, setAvailableServers] = useState({ sub: [], dub: [] });
  const [currentAudioType, setCurrentAudioType] = useState("sub");
  const [currentServer, setCurrentServer] = useState(null);
  const [errorToast, setErrorToast] = useState(null);
  const [episodeSearch, setEpisodeSearch] = useState("");

  const showError = useCallback((msg) => {
    setErrorToast(msg);
    setTimeout(() => setErrorToast(null), 5000);
  }, []);

  // ── Load Platforms from Worker on mount ──────────────────────────────────────
  useEffect(() => {
    api.platforms()
      .then((data) => {
        const list = Array.isArray(data) ? data : data.platforms || [];
        if (list.length > 0) {
          setPlatforms(list);
          setSelectedPlatform((curr) => {
            const found = list.find((p) => p.name.toLowerCase() === curr.name.toLowerCase());
            return found || curr;
          });
        }
      })
      .catch((e) => console.warn("Notice: platforms fetch fallback to default", e.message));
  }, []);

  // ── Fetch Catalog (Search or Browse Tabs) ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingCatalog(true);

    const platformName = selectedPlatform.name;

    // If URL has ?q=query, we search
    if (searchParam) {
      api.search(searchParam, catalogPage, platformName)
        .then((data) => {
          if (cancelled) return;
          setCatalogList(data.items || []);
          setTotalPages(data.totalPages || 1);
        })
        .catch((e) => {
          if (!cancelled) showError(`Failed searching ${platformName}: ${e.message}`);
        })
        .finally(() => {
          if (!cancelled) setLoadingCatalog(false);
        });
    } else {
      // Home page: Browse Latest or Popular
      const fetchPromise =
        homeTab === "latest"
          ? api.latest(catalogPage, platformName)
          : api.popular(catalogPage, platformName);

      fetchPromise
        .then((data) => {
          if (cancelled) return;
          const items = data.items || [];
          setCatalogList(items);
          setTotalPages(data.totalPages || 1);
          // Set featured anime from popular/latest items if not already set
          if (items.length > 0 && (!featuredAnime || catalogPage === 1)) {
            setFeaturedAnime(items[0]);
          }
        })
        .catch((e) => {
          if (!cancelled) showError(`Failed loading ${platformName} ${homeTab}: ${e.message}`);
        })
        .finally(() => {
          if (!cancelled) setLoadingCatalog(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [searchParam, homeTab, catalogPage, selectedPlatform.name, showError]);

  // ── Switch Platform ─────────────────────────────────────────────────────────
  const handleSelectPlatform = (platform) => {
    if (platform.name === selectedPlatform.name) return;
    setSelectedPlatform(platform);
    try {
      localStorage.setItem("animex_platform", JSON.stringify(platform));
    } catch (_) {}

    // Reset view
    setView("browse");
    setSelectedAnime(null);
    setEpisodeData(null);
    setActiveEpisode(null);
    setStreamUrl(null);
    setCatalogPage(1);
    setFeaturedAnime(null);
  };

  // ── Anime Card Click ────────────────────────────────────────────────────────
  const handleAnimeClick = async (anime) => {
    setSelectedAnime(anime);
    setView("episodes");
    setLoadingEpisodes(true);
    setEpisodeData(null);
    setActiveEpisode(null);
    setStreamUrl(null);
    setEpisodeSearch("");

    try {
      const data = await api.episodes(anime.url, selectedPlatform.name);
      setEpisodeData(data);
    } catch (e) {
      showError(`Could not load episodes from ${selectedPlatform.name}: ${e.message}`);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  // ── Episode Click (Extract Stream & Play) ───────────────────────────────────
  const handleEpisodeClick = async (ep, audioType = "sub", serverName = null) => {
    setActiveEpisode(ep);
    setLoadingStream(true);
    setView("playing");

    try {
      const res = await api.extract(ep.url, {
        type: audioType,
        server: serverName,
        platform: selectedPlatform.name,
      });

      if (!res.streamUrl) {
        throw new Error("No playable video stream returned from provider.");
      }

      setStreamUrl(api.proxyHls(res.streamUrl));
      setSubtitles(res.subtitles || []);
      setCurrentAudioType(res.audioType || audioType);
      setCurrentServer(res.server || serverName);
      setAvailableServers({
        sub: res.availableServers?.sub || [],
        dub: res.availableServers?.dub || [],
      });
    } catch (e) {
      showError(`Stream extraction failed: ${e.message}`);
    } finally {
      setLoadingStream(false);
    }
  };

  // Filter episodes by search input
  const filteredEpisodes = useMemo(() => {
    if (!episodeData?.episodes) return [];
    if (!episodeSearch.trim()) return episodeData.episodes;
    return episodeData.episodes.filter(
      (ep) =>
        ep.name?.toLowerCase().includes(episodeSearch.toLowerCase()) ||
        String(ep.episode)?.includes(episodeSearch)
    );
  }, [episodeData, episodeSearch]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white/20">
      {/* ════════════════════════════════════════════════════════════════════════
         APPLE TV FROSTED GLASS NAVIGATION BAR
         ════════════════════════════════════════════════════════════════════════ */}
      <header className="apple-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          {/* Brand Logo & Back to Home */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {view !== "browse" && (
              <button
                onClick={() => {
                  setView("browse");
                  setStreamUrl(null);
                }}
                className="liquidGlass-wrapper w-9 h-9 border border-white/20"
                title="Back to Catalog"
                aria-label="Back to Catalog"
              >
                <div className="liquidGlass-effect" />
                <div className="liquidGlass-shine" />
                <div className="liquidGlass-constant" />
                <div className="liquidGlass-text">
                  <ChevronLeftIcon className="w-5 h-5 text-white" />
                </div>
              </button>
            )}

            <button
              onClick={() => {
                handleClearSearch();
                setView("browse");
                setStreamUrl(null);
              }}
              className="flex items-center gap-2 group text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-white text-black font-black flex items-center justify-center text-sm tracking-tighter shadow-md">
                AX
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white group-hover:text-white/80 transition-colors">
                  AnimeX
                </span>
                <span className="text-[9px] uppercase tracking-widest text-white/40 font-mono">
                  tvOS
                </span>
              </div>
            </button>
          </div>

          {/* Central Apple TV Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="flex-1 max-w-md relative"
          >
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-white/40 pointer-events-none">
                <SearchIcon className="w-4 h-4" />
              </span>
              <input
                type="search"
                placeholder={`Search anime on ${selectedPlatform.name}...`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="apple-search-input pr-8"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-3 text-white/50 hover:text-white text-sm"
                  aria-label="Clear Search"
                >
                  ✕
                </button>
              )}
            </div>
          </form>

          {/* Top Right: Selected Platform with Logo and Name */}
          <div className="flex-shrink-0">
            <PlatformSelector
              platforms={platforms}
              selectedPlatform={selectedPlatform}
              onSelectPlatform={handleSelectPlatform}
            />
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════════════
         MAIN CONTENT AREA
         ════════════════════════════════════════════════════════════════════════ */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex flex-col gap-8">
        {/* ══════════════ VIEW: BROWSE / SEARCH RESULTS ══════════════ */}
        {view === "browse" && (
          <>
            {/* If NO search query: Apple TV Top Shelf Hero Banner */}
            {!searchParam && featuredAnime && (
              <section className="apple-hero animate-fade-in">
                {featuredAnime.thumbnail && (
                  <img
                    src={featuredAnime.thumbnail}
                    alt=""
                    className="apple-hero-bg"
                  />
                )}
                <div className="apple-hero-overlay" />

                <div className="apple-hero-content">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/20 backdrop-blur-md text-white border border-white/20">
                      Top Pick · {selectedPlatform.name}
                    </span>
                    {featuredAnime.episodeLabel && (
                      <span className="text-xs text-white/70 font-medium">
                        {featuredAnime.episodeLabel}
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-3 line-clamp-2">
                    {featuredAnime.title}
                  </h1>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleAnimeClick(featuredAnime)}
                      className="liquidGlass-wrapper px-5 py-2.5 h-11 border border-white/25 gap-2 font-semibold text-sm"
                    >
                      <div className="liquidGlass-effect" />
                      <div className="liquidGlass-shine" />
                      <div className="liquidGlass-constant" />
                      <div className="liquidGlass-text flex items-center gap-2">
                        <PlayMiniIcon className="w-4 h-4 text-white" />
                        <span>Stream Now</span>
                      </div>
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Shelf Header & Category Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <h2 className="apple-section-title">
                  {searchParam ? (
                    <>
                      Results for <span className="text-white/60">“{searchParam}”</span>
                    </>
                  ) : homeTab === "latest" ? (
                    "Latest Releases"
                  ) : (
                    "Top Popular Anime"
                  )}
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Streaming from {selectedPlatform.name}
                </p>
              </div>

              {/* If on home (no searchParam), show tabs */}
              {!searchParam ? (
                <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10 self-start sm:self-auto">
                  <button
                    onClick={() => {
                      setHomeTab("latest");
                      setCatalogPage(1);
                    }}
                    className={`apple-tab ${homeTab === "latest" ? "active" : ""}`}
                  >
                    Latest Updates
                  </button>
                  <button
                    onClick={() => {
                      setHomeTab("popular");
                      setCatalogPage(1);
                    }}
                    className={`apple-tab ${homeTab === "popular" ? "active" : ""}`}
                  >
                    Popular Hits
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleClearSearch}
                  className="apple-tab active self-start sm:self-auto"
                >
                  Clear search ✕
                </button>
              )}
            </div>

            {/* Anime Grid */}
            {loadingCatalog ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="apple-card skeleton" />
                ))}
              </div>
            ) : catalogList.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 animate-fade-in">
                {catalogList.map((item, idx) => (
                  <AnimeCard
                    key={`${item.url || item.link}-${idx}`}
                    item={item}
                    onClick={() => handleAnimeClick(item)}
                  />
                ))}
              </div>
            ) : (
              <div className="glass p-12 text-center text-white/60 animate-fade-in">
                <p className="text-lg font-medium text-white mb-2">No anime found</p>
                <p className="text-sm">
                  {searchParam
                    ? `No matches for "${searchParam}" on ${selectedPlatform.name}. Try another query or switch source from the top right.`
                    : `No items available on ${selectedPlatform.name} right now.`}
                </p>
                {searchParam && (
                  <button
                    onClick={handleClearSearch}
                    className="apple-tab active mt-4"
                  >
                    Return to Catalog
                  </button>
                )}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setCatalogPage((p) => Math.max(1, p - 1))}
                  disabled={catalogPage <= 1}
                  className="apple-tab disabled:opacity-30 disabled:pointer-events-none"
                >
                  Previous
                </button>
                <span className="text-xs font-mono text-white/50">
                  Page {catalogPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCatalogPage((p) => Math.min(totalPages, p + 1))}
                  disabled={catalogPage >= totalPages}
                  className="apple-tab disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ VIEW: EPISODES & LIQUID GLASS PLAYER ══════════════ */}
        {(view === "episodes" || view === "playing") && selectedAnime && (
          <div className="animate-fade-in flex flex-col gap-6">
            {/* Top Player Stage (when streaming) */}
            {view === "playing" && (
              <div className="w-full flex flex-col gap-3">
                {loadingStream && !streamUrl ? (
                  <div className="liquid-player-ctr vid-ctr flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="loader" />
                      <p className="text-xs text-white/60">
                        Connecting to stream on {selectedPlatform.name}…
                      </p>
                    </div>
                  </div>
                ) : streamUrl ? (
                  <Player
                    streamUrl={streamUrl}
                    subtitles={subtitles}
                    title={
                      activeEpisode
                        ? `${selectedAnime.title} · ${activeEpisode.name || `Episode ${activeEpisode.episode}`}`
                        : selectedAnime.title
                    }
                    onClose={() => setView("episodes")}
                    onError={showError}
                  />
                ) : null}

                {/* Sub / Dub & Server Controls */}
                {(availableServers.sub?.length > 0 || availableServers.dub?.length > 0) && (
                  <div className="glass p-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Audio Selector (SUB / DUB) */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/50 uppercase font-semibold">
                        Audio:
                      </span>
                      <div className="flex items-center bg-white/10 p-0.5 rounded-full border border-white/10">
                        {availableServers.sub?.length > 0 && (
                          <button
                            onClick={() => {
                              if (currentAudioType !== "sub" && activeEpisode) {
                                handleEpisodeClick(activeEpisode, "sub", availableServers.sub[0]);
                              }
                            }}
                            className={`audio-toggle-btn ${
                              currentAudioType === "sub" ? "active" : "inactive"
                            }`}
                          >
                            Sub
                          </button>
                        )}
                        {availableServers.dub?.length > 0 && (
                          <button
                            onClick={() => {
                              if (currentAudioType !== "dub" && activeEpisode) {
                                handleEpisodeClick(activeEpisode, "dub", availableServers.dub[0]);
                              }
                            }}
                            className={`audio-toggle-btn ${
                              currentAudioType === "dub" ? "active" : "inactive"
                            }`}
                          >
                            Dub
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Server Switcher */}
                    {availableServers[currentAudioType]?.length > 1 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/50 uppercase font-semibold">
                          Server:
                        </span>
                        <select
                          value={currentServer || ""}
                          onChange={(e) => {
                            if (activeEpisode) {
                              handleEpisodeClick(activeEpisode, currentAudioType, e.target.value);
                            }
                          }}
                          className="bg-black/60 text-white text-xs rounded-xl px-2.5 py-1.5 border border-white/20 outline-none cursor-pointer"
                        >
                          {availableServers[currentAudioType].map((srv) => (
                            <option key={srv} value={srv}>
                              {srv}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Anime Details & Episodes Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Anime Information Card */}
              <div className="glass p-5 flex flex-col sm:flex-row lg:flex-col gap-4">
                {selectedAnime.thumbnail && (
                  <img
                    src={selectedAnime.thumbnail}
                    alt=""
                    className="w-32 sm:w-40 lg:w-full rounded-xl object-cover aspect-[2/3] border border-white/10 flex-shrink-0"
                  />
                )}
                <div className="flex flex-col gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    {selectedAnime.title}
                  </h2>
                  <p className="text-xs text-white/50 font-mono">
                    Source: {selectedPlatform.name}
                  </p>
                  {episodeData?.description && (
                    <p className="text-xs text-white/70 line-clamp-4 leading-relaxed mt-1">
                      {episodeData.description}
                    </p>
                  )}
                  {episodeData?.genre && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {String(episodeData.genre)
                        .split(",")
                        .map((g, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-full text-[10px] bg-white/10 text-white/80 border border-white/10"
                          >
                            {g.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Episodes List Drawer */}
              <div className="glass p-5 lg:col-span-2 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 flex-wrap">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Episodes
                    <span className="text-xs font-mono font-normal text-white/40">
                      ({filteredEpisodes.length})
                    </span>
                  </h3>

                  {/* Filter episodes by number */}
                  {episodeData?.episodes?.length > 10 && (
                    <input
                      type="text"
                      placeholder="Find episode..."
                      value={episodeSearch}
                      onChange={(e) => setEpisodeSearch(e.target.value)}
                      className="bg-white/10 border border-white/15 rounded-xl px-3 py-1 text-xs text-white placeholder-white/40 outline-none focus:border-white/30 w-36"
                    />
                  )}
                </div>

                {loadingEpisodes ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="skeleton h-12 rounded-xl" />
                    ))}
                  </div>
                ) : filteredEpisodes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[480px] overflow-y-auto no-scrollbar pr-1">
                    {filteredEpisodes.map((ep, idx) => {
                      const isCurrent = activeEpisode?.url === ep.url;
                      return (
                        <button
                          key={ep.url || idx}
                          onClick={() => handleEpisodeClick(ep)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-left text-xs transition-all border ${
                            isCurrent
                              ? "bg-white text-black font-bold border-white shadow-lg"
                              : "bg-white/5 text-white/80 border-white/10 hover:bg-white/15 hover:text-white"
                          }`}
                        >
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] ${
                              isCurrent ? "bg-black text-white" : "bg-white/10 text-white/70"
                            }`}
                          >
                            {isCurrent ? "▶" : ep.episode || idx + 1}
                          </span>
                          <span className="truncate flex-1">
                            {ep.name || `Episode ${ep.episode || idx + 1}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center text-white/40 text-xs">
                    No episodes found for this anime on {selectedPlatform.name}.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════════════════
         APPLE TV MINIMALIST FOOTER
         ════════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/10 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white/60">AnimeX TV</span>
            <span>·</span>
            <span>Liquid Glass Architecture</span>
            <span>·</span>
            <span className="text-white/70">{selectedPlatform.name}</span>
          </div>
          <p className="font-mono text-[11px]">tvOS Dark Minimalist Edition</p>
        </div>
      </footer>

      {/* ════════════════════════════════════════════════════════════════════════
         ERROR NOTIFICATION TOAST
         ════════════════════════════════════════════════════════════════════════ */}
      {errorToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-white/20 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
          <span className="text-red-400">⚠️</span>
          <span className="text-xs flex-1">{errorToast}</span>
          <button
            onClick={() => setErrorToast(null)}
            className="text-white/50 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
