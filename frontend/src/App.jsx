/**
 * App.jsx — AnimeX main application
 *
 * State flow:
 *   "browse"  → shows anime grid (latest / search results)
 *   "episodes"→ shows episode list for a selected anime
 *   "playing" → shows Player component with active stream
 *
 * API calls go to /api/* which Vite proxies to the Worker in dev
 * and to VITE_API_BASE in production.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import Player from "./components/Player.jsx";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Set VITE_API_BASE in your .env for production, e.g. https://animex.worker.dev */
const API_BASE = import.meta.env.VITE_API_BASE || "";

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
  latest: (page = 1) => apiFetch(`/api/latest?page=${page}`),
  search: (q, page = 1) =>
    apiFetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}`),
  episodes: (url) => apiFetch(`/api/episodes?url=${encodeURIComponent(url)}`),
  extract: (url, opts = {}) => {
    const params = new URLSearchParams();
    if (url) params.set("url", url);
    if (opts.type) params.set("type", opts.type);
    if (opts.server) params.set("server", opts.server);
    if (opts.linkId) params.set("linkId", opts.linkId);
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
          <span className="text-4xl opacity-40">🎌</span>
        </div>
      )}

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(to top, rgba(13,58,92,0.95) 0%, rgba(13,58,92,0.5) 50%, transparent 100%)",
        }}
      />

      {/* Episode badge */}
      {item.episodeLabel && (
        <span className="ep-pill">{item.episodeLabel}</span>
      )}

      {/* Title on hover */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 translate-y-2
                   opacity-0 group-hover:opacity-100 group-hover:translate-y-0
                   transition-all duration-300"
      >
        <p className="text-ivory text-sm font-semibold line-clamp-2 leading-tight">
          {item.title}
        </p>
        {item.released && (
          <p className="text-gold text-xs mt-0.5 font-mono">{item.released}</p>
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
                  ${isActive
          ? "bg-gold/20 border border-gold/40"
          : "hover:bg-white/5 border border-transparent"
        }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0
                    ${isActive ? "bg-gold text-navy" : "bg-navy-800/60 text-gold group-hover:bg-azure/40"}`}
      >
        {ep.episode}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className={`text-sm font-medium truncate ${isActive ? "text-ivory" : "text-ivory-muted"}`}>
          {ep.label || `Episode ${ep.episode}`}
        </span>
        {ep.badge && (
          <span className="text-[10px] font-mono text-gold/70 mt-0.5">
            {ep.badge}
          </span>
        )}
      </div>
      {isActive && (
        <span className="ml-auto text-gold text-xs font-semibold flex-shrink-0">▶ Now Playing</span>
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
      <span className="text-red-400 text-lg flex-shrink-0">⚠</span>
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

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  // ── View state ──────────────────────────────────────────────────────────────
  const [view, setView] = useState("browse"); // "browse" | "episodes" | "playing"
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceTimer = useRef(null);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [animeList, setAnimeList] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingList, setLoadingList] = useState(true);

  const [selectedAnime, setSelectedAnime] = useState(null);  // { title, url, thumbnail }
  const [episodeData, setEpisodeData] = useState(null);       // { episodes: [], totalEpisodes, ... }
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  const [activeEpisode, setActiveEpisode] = useState(null);   // { episode, url }
  const [streamUrl, setStreamUrl] = useState(null);           // proxied HLS URL
  const [subtitles, setSubtitles] = useState([]);             // available subtitle tracks
  const [loadingStream, setLoadingStream] = useState(false);

  // Audio type & server selection state
  const [currentType, setCurrentType] = useState("sub");       // "sub" | "dub"
  const [currentServer, setCurrentServer] = useState("");     // active server name
  const [availableServers, setAvailableServers] = useState({ sub: [], dub: [] });
  const [playbackTime, setPlaybackTime] = useState(0);

  // ── Error state ─────────────────────────────────────────────────────────────
  const [error, setError] = useState(null);

  const showError = useCallback((msg) => {
    setError(msg);
    console.error("[AnimeX]", msg);
  }, []);

  // ── Fetch anime list ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    setAnimeList([]);

    const task = debouncedQuery
      ? api.search(debouncedQuery, page)
      : api.latest(page);

    task
      .then((data) => {
        if (cancelled) return;
        setAnimeList(data.items || []);
        setTotalPages(data.totalPages || 1);
      })
      .catch((e) => {
        if (!cancelled) showError(`Failed to load anime: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingList(false);
      });

    return () => { cancelled = true; };
  }, [debouncedQuery, page, showError]);

  // Search debounce
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 500);
    return () => clearTimeout(debounceTimer.current);
  }, [searchQuery]);

  // ── Select anime → load episodes ────────────────────────────────────────────
  const handleAnimeClick = useCallback(async (item) => {
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
    setLoadingEpisodes(true);

    try {
      const data = await api.episodes(item.url);
      setEpisodeData(data);
    } catch (e) {
      showError(`Failed to load episodes: ${e.message}`);
      setView("browse");
    } finally {
      setLoadingEpisodes(false);
    }
  }, [selectedAnime, view, showError]);

  // ── Select episode → extract & proxy stream ─────────────────────────────────
  const handleEpisodeClick = useCallback(
    async (ep, type = currentType, server = "", linkId = "", keepTime = false) => {
      const isDifferentEpisode = activeEpisode?.url !== ep.url;
      if (!keepTime && isDifferentEpisode) {
        setPlaybackTime(0);
      }
      setActiveEpisode(ep);
      setLoadingStream(true);
      setView("playing");

      try {
        const extracted = await api.extract(ep.url, { type, server, linkId });
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
        showError(`Failed to load stream: ${e.message}`);
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
    [activeEpisode, currentType, showError]
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
      handleEpisodeClick(activeEpisode, currentType, serverObj.name, serverObj.linkId, true);
    },
    [currentServer, activeEpisode, loadingStream, currentType, handleEpisodeClick]
  );

  // ── Navigation helpers ───────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (view === "playing") {
      setView("episodes");
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
    setStreamUrl(null);
    setSubtitles([]);
    setPlaybackTime(0);
  }, []);

  // ── Title for the browser tab ────────────────────────────────────────────────
  useEffect(() => {
    document.title = selectedAnime
      ? `${selectedAnime.title} — AnimeX`
      : "AnimeX — Stream Unlimited";
  }, [selectedAnime]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col">

      {/* ── Navbar ── */}
      <header className="glass-nav sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">

          {/* Logo */}
          <button
            onClick={() => { setView("browse"); setSelectedAnime(null); setSearchQuery(""); }}
            className="flex items-center gap-2 flex-shrink-0 group"
          >
            <span className="text-2xl select-none">🎌</span>
            <span className="text-gradient-gold font-extrabold text-xl tracking-tight">
              AnimeX
            </span>
          </button>

          {/* Back breadcrumb */}
          {view !== "browse" && (
            <button onClick={goBack} className="btn-ghost text-xs">
              ← {view === "playing" ? "Episodes" : "Back"}
            </button>
          )}

          {/* Search — only on browse view */}
          {view === "browse" && (
            <div className="flex-1 max-w-md ml-auto relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory-muted text-sm pointer-events-none">
                🔍
              </span>
              <input
                type="search"
                placeholder="Search anime…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input pl-9"
              />
            </div>
          )}

          {/* Anime title in episodes/playing view */}
          {view !== "browse" && selectedAnime && (
            <div className="flex-1 ml-2 min-w-0">
              <p className="text-ivory font-semibold text-sm truncate">
                {selectedAnime.title}
              </p>
              {episodeData && (
                <p className="text-gold text-xs font-mono">
                  {episodeData.totalEpisodes} episodes
                </p>
              )}
            </div>
          )}

          {/* Page indicator on browse */}
          {view === "browse" && (
            <div className="ml-auto flex-shrink-0">
              <span className="tag font-mono">
                {debouncedQuery ? "search" : `p.${page}`}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">

        {/* ══════ BROWSE VIEW ══════ */}
        {view === "browse" && (
          <div className="animate-fade-in">
            <h1 className="section-title">
              {debouncedQuery ? `Results for "${debouncedQuery}"` : "Latest Episodes"}
            </h1>

            {loadingList ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {Array.from({ length: 18 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : animeList.length === 0 ? (
              <div className="glass p-12 text-center animate-fade-in">
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-ivory font-semibold text-lg">No results found</p>
                <p className="text-ivory-muted text-sm mt-1">
                  Try a different search term or browse the latest page
                </p>
                {debouncedQuery && (
                  <button
                    onClick={() => { setSearchQuery(""); setDebouncedQuery(""); }}
                    className="btn-gold mt-4"
                  >
                    Browse Latest
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 animate-slide-up">
                  {animeList.map((item, i) => (
                    <AnimeCard
                      key={`${item.url}-${i}`}
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
        )}

        {/* ══════ EPISODES VIEW ══════ */}
        {(view === "episodes" || view === "playing") && selectedAnime && (
          <div className="animate-fade-in">
            {/* ── Player (shown when streaming) ── */}
            {view === "playing" && (
              <div className="mb-6">
                {loadingStream && !streamUrl ? (
                  <div className="player-wrapper flex items-center justify-center min-h-[320px]">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full border-4 border-gold/20 border-t-gold animate-spin" />
                      <p className="text-ivory-muted text-sm">Extracting stream…</p>
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
                            <span className="text-xs font-semibold text-ivory">Switching stream…</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Sub/Dub & Server Controls ── */}
                    {(availableServers.sub?.length > 0 || availableServers.dub?.length > 0) && (
                      <div className="glass px-4 py-3 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                        {/* Audio Type Toggle (SUB / DUB) */}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-muted/70">
                            Audio:
                          </span>
                          <div className="flex items-center bg-navy-900/80 p-0.5 rounded-lg border border-white/10">
                            <button
                              onClick={() => handleSwitchType("sub")}
                              disabled={loadingStream || availableServers.sub?.length === 0}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                currentType === "sub"
                                  ? "bg-gold text-navy shadow-sm"
                                  : availableServers.sub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-ivory"
                              }`}
                            >
                              SUB {availableServers.sub?.length > 0 ? `(${availableServers.sub.length})` : ""}
                            </button>
                            <button
                              onClick={() => handleSwitchType("dub")}
                              disabled={loadingStream || availableServers.dub?.length === 0}
                              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                                currentType === "dub"
                                  ? "bg-gold text-navy shadow-sm"
                                  : availableServers.dub?.length === 0
                                  ? "opacity-30 cursor-not-allowed text-ivory-muted"
                                  : "text-ivory-muted hover:text-ivory"
                              }`}
                            >
                              DUB {availableServers.dub?.length > 0 ? `(${availableServers.dub.length})` : ""}
                            </button>
                          </div>
                        </div>

                        {/* Server Switcher */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-ivory-muted/70">
                            Server:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {((currentType === "dub" ? availableServers.dub : availableServers.sub) || []).map((srv) => {
                              const isSelected = currentServer.toLowerCase() === srv.name.toLowerCase();
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
                                  {isSelected ? "● " : ""}{srv.name}
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
            <div className="glass p-5 mb-6 flex gap-5 items-start">
              {/* Thumbnail */}
              {selectedAnime.thumbnail && (
                <img
                  src={selectedAnime.thumbnail}
                  alt={selectedAnime.title}
                  className="w-20 h-28 object-cover rounded-xl flex-shrink-0 ring-1 ring-gold/20"
                />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-ivory mb-1 leading-tight">
                  {selectedAnime.title}
                </h2>
                {episodeData?.description && (
                  <p className="text-ivory-muted text-sm leading-relaxed line-clamp-3 mt-2">
                    {episodeData.description}
                  </p>
                )}
                {episodeData && (
                  <div className="flex items-center gap-3 mt-3">
                    <span className="tag">{episodeData.totalEpisodes} Episodes</span>
                    {activeEpisode && (
                      <span className="tag bg-gold/20 text-gold border-gold/30">
                        ▶ EP {activeEpisode.episode}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Episode list ── */}
            <h3 className="section-title">Episodes</h3>

            {loadingEpisodes ? (
              <div className="space-y-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : episodeData?.episodes?.length ? (
              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 no-scrollbar">
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
                <p className="text-ivory-muted">No episodes found for this title.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 mt-auto py-5">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-ivory-muted text-xs">
            AnimeX · Cloudflare Workers + React · MIT
          </p>
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
