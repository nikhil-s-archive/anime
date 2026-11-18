import React, { useState, useEffect, useMemo } from "react";
import { getAllDownloads, deleteDownload, clearAllDownloads, formatBytes, getStorageEstimate } from "../services/localDb.js";
import { downloadManager } from "../services/downloadManager.js";

function PlayIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function DownloadIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SubtitleIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h3m4 0h3M7 11h10" />
    </svg>
  );
}

function CloseIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function WifiOffIcon({ className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
      <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
      <line x1="12" y1="20" x2="12.01" y2="20" />
    </svg>
  );
}

export default function DownloadsPage({ onPlayOffline, onNavigateHome, isOffline }) {
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [savedDownloads, setSavedDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState("all");
  const [storageInfo, setStorageInfo] = useState({ usage: 0, formattedUsage: "0 B" });
  const [thumbnailUrls, setThumbnailUrls] = useState({});

  // 1. Subscribe to active download queue
  useEffect(() => {
    const unsubscribe = downloadManager.subscribe((queue) => {
      setDownloadQueue(queue);
    });
    return unsubscribe;
  }, []);

  // 2. Load stored downloads from IndexedDB
  const refreshSaved = async () => {
    try {
      setLoading(true);
      const items = await getAllDownloads();
      setSavedDownloads(items);

      // Create object URLs for offline thumbnails
      const newThumbUrls = {};
      items.forEach((item) => {
        if (item.thumbnailBlob) {
          try {
            newThumbUrls[item.id] = URL.createObjectURL(item.thumbnailBlob);
          } catch (_) {}
        }
      });
      setThumbnailUrls((prev) => {
        // revoke old ones
        Object.values(prev).forEach((u) => URL.revokeObjectURL(u));
        return newThumbUrls;
      });

      const estimate = await getStorageEstimate();
      setStorageInfo(estimate);
    } catch (e) {
      console.error("Error loading downloads:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSaved();
  }, [downloadQueue.some((t) => t.status === "completed")]);

  // Clean up thumbnail blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(thumbnailUrls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  // Filtered downloads
  const animeGroups = useMemo(() => {
    const map = new Map();
    savedDownloads.forEach((it) => {
      const title = it.animeTitle || "Unknown Anime";
      map.set(title, (map.get(title) || 0) + 1);
    });
    return Array.from(map.entries()).map(([title, count]) => ({ title, count }));
  }, [savedDownloads]);

  const filteredItems = useMemo(() => {
    return savedDownloads.filter((it) => {
      if (selectedAnimeFilter !== "all" && it.animeTitle !== selectedAnimeFilter) {
        return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchTitle = (it.animeTitle || "").toLowerCase().includes(q);
        const matchEp = (it.episodeTitle || "").toLowerCase().includes(q);
        const matchQuality = (it.quality || "").toLowerCase().includes(q);
        return matchTitle || matchEp || matchQuality;
      }
      return true;
    });
  }, [savedDownloads, selectedAnimeFilter, searchFilter]);

  const handleDelete = async (id, title) => {
    if (window.confirm(`Delete "${title}" from offline downloads?`)) {
      await deleteDownload(id);
      await refreshSaved();
    }
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to delete all offline downloaded anime?")) {
      await clearAllDownloads();
      await refreshSaved();
    }
  };

  return (
    <div className="downloads-page max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 animate-fade-in text-ivory">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Downloads &amp; Offline</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {savedDownloads.length} {savedDownloads.length === 1 ? "Episode" : "Episodes"}
              </span>
            </h1>

            {isOffline ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                <WifiOffIcon className="h-3.5 w-3.5" />
                Offline Mode
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-ivory-muted mt-1.5">
            Watch your downloaded anime anytime, even without internet access.
          </p>
        </div>

        {/* Storage info & Actions */}
        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-right">
            <span className="block text-[10px] uppercase tracking-wider text-ivory-muted font-mono">
              Offline Storage
            </span>
            <span className="text-sm font-bold text-white font-mono">
              {storageInfo.formattedUsage}
            </span>
          </div>

          {savedDownloads.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 text-xs font-semibold text-rose-300/80 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all"
              title="Delete all downloaded files to free space"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Active Downloads Queue ── */}
      {downloadQueue.length > 0 && (
        <section className="mt-6 mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              Active Download Queue ({downloadQueue.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {downloadQueue.map((task) => (
              <div
                key={task.id}
                className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-cyan-500/25 p-3.5 backdrop-blur-xl shadow-lg transition-all"
              >
                <div className="flex items-start gap-3.5">
                  {/* Thumbnail / Poster */}
                  <div className="w-14 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 shrink-0 relative">
                    {task.thumbnail ? (
                      <img
                        src={task.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/20">
                        <DownloadIcon />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  </div>

                  {/* Task details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <h3 className="font-bold text-sm text-white truncate">
                          {task.animeTitle}
                        </h3>
                        <p className="text-xs text-ivory-muted truncate mt-0.5">
                          {task.episodeTitle}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadManager.cancelDownload(task.id)}
                        className="p-1 rounded-lg text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        title="Cancel download"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Badge */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/80 uppercase font-mono">
                        {task.quality || "Standard"}
                      </span>
                      {task.status === "downloading" && (
                        <span className="text-[10px] font-mono text-cyan-300">
                          {task.speed || "Downloading..."}
                        </span>
                      )}
                      {task.status === "queued" && (
                        <span className="text-[10px] text-amber-300 font-mono">
                          Queued...
                        </span>
                      )}
                      {task.status === "error" && (
                        <span className="text-[10px] text-rose-400 font-mono">
                          {task.error || "Failed"}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300 rounded-full shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-white/60 mt-1.5">
                        <span>
                          {task.completedChunks} / {task.totalChunks} chunks
                          {task.bytesDownloaded > 0 && ` (${formatBytes(task.bytesDownloaded)})`}
                        </span>
                        <span className="font-bold text-white">
                          {task.progress || 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Filters & Search ── */}
      {savedDownloads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 mb-5">
          {/* Search within downloads */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search downloaded anime or episodes..."
              className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 transition-colors"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-white/30 pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                className="absolute right-3 top-2.5 text-white/40 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Anime Groups Chips */}
          {animeGroups.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                type="button"
                onClick={() => setSelectedAnimeFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedAnimeFilter === "all"
                    ? "bg-white text-black font-bold shadow-md"
                    : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/10"
                }`}
              >
                All ({savedDownloads.length})
              </button>
              {animeGroups.map(({ title, count }) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => setSelectedAnimeFilter(title)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedAnimeFilter === title
                      ? "bg-white text-black font-bold shadow-md"
                      : "bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {title} ({count})
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Downloaded Items Grid ── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-ivory-muted gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
          <p className="text-xs">Loading offline library…</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const thumbSrc = thumbnailUrls[item.id] || item.thumbnail;
            const hasSubs = Array.isArray(item.subtitles) && item.subtitles.length > 0;

            return (
              <div
                key={item.id}
                className="group relative rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 hover:border-cyan-500/30 overflow-hidden flex flex-col transition-all duration-300 shadow-lg hover:shadow-cyan-500/5"
              >
                {/* Poster / Thumbnail Header */}
                <div className="relative aspect-video w-full overflow-hidden bg-black/50">
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={item.animeTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <DownloadIcon className="h-10 w-10" />
                    </div>
                  )}

                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                  {/* Play Button Overlay */}
                  <button
                    type="button"
                    onClick={() => onPlayOffline(item)}
                    className="absolute inset-0 m-auto w-13 h-13 rounded-full bg-cyan-500/90 hover:bg-cyan-400 text-black flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.6)] transform group-hover:scale-110 transition-all z-10"
                    title="Play Offline Video"
                  >
                    <PlayIcon className="h-6 w-6 ml-0.5" />
                  </button>

                  {/* Badges on poster */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-cyan-300 border border-cyan-400/30">
                      {item.quality || "Standard"}
                    </span>
                    {hasSubs && (
                      <span className="text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-emerald-300 border border-emerald-400/30">
                        <SubtitleIcon className="h-3 w-3" />
                        Subtitles ({item.subtitles.length})
                      </span>
                    )}
                  </div>

                  {item.platform && (
                    <span className="absolute top-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white/60">
                      {item.platform}
                    </span>
                  )}

                  {/* Duration and size label */}
                  <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] font-mono text-white/80">
                    <span>{formatBytes(item.totalSize || 0)}</span>
                    {item.duration > 0 && (
                      <span>{Math.floor(item.duration / 60)} min</span>
                    )}
                  </div>
                </div>

                {/* Details & Actions Body */}
                <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                      {item.animeTitle}
                    </h3>
                    <p className="text-xs text-ivory-muted line-clamp-1 mt-0.5">
                      {item.episodeTitle || `Episode ${item.episodeNumber}`}
                    </p>
                    <p className="text-[10px] font-mono text-white/40 mt-1">
                      Downloaded on {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    {/* Primary Play Button */}
                    <button
                      type="button"
                      onClick={() => onPlayOffline(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white text-black hover:bg-cyan-300 font-bold text-xs transition-all shadow-md"
                    >
                      <PlayIcon className="h-3.5 w-3.5" />
                      Play Offline
                    </button>

                    {/* Save to Device */}
                    <button
                      type="button"
                      onClick={() => downloadManager.saveToDevice(item)}
                      className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-all border border-white/10"
                      title="Export video file (.ts/.mp4) to device downloads"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>

                    {/* Export Subtitles if available */}
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={() => downloadManager.saveSubtitleToDevice(item, 0)}
                        className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-emerald-300/80 hover:text-emerald-200 transition-all border border-white/10"
                        title="Export subtitle file (.srt) to device downloads"
                      >
                        <SubtitleIcon className="h-4 w-4" />
                      </button>
                    )}

                    {/* Delete from DB */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, `${item.animeTitle} - ${item.episodeTitle}`)}
                      className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-white/40 hover:text-rose-300 transition-all border border-white/5 hover:border-rose-500/30"
                      title="Delete from local database"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : savedDownloads.length > 0 ? (
        // No items matching search
        <div className="py-16 text-center text-ivory-muted">
          <p className="text-sm">No downloaded anime matched &ldquo;{searchFilter}&rdquo;.</p>
          <button
            type="button"
            onClick={() => {
              setSearchFilter("");
              setSelectedAnimeFilter("all");
            }}
            className="mt-3 text-xs text-cyan-400 hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        // Empty State
        <div className="py-16 sm:py-24 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-white/30 mb-4 shadow-xl">
            <DownloadIcon className="h-8 w-8" />
          </div>

          <h3 className="text-lg font-bold text-white mb-1.5">
            {isOffline ? "You are offline" : "No downloaded anime yet"}
          </h3>

          <p className="text-xs sm:text-sm text-ivory-muted leading-relaxed mb-6">
            {isOffline
              ? "You do not have any downloaded videos available for offline viewing. Reconnect to the internet to browse and download episodes."
              : "Download your favorite anime episodes and regional dubbed streams. They are saved directly to your local database with subtitles so you can watch offline anytime."}
          </p>

          {!isOffline && onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-5 py-2.5 rounded-xl bg-white text-black hover:bg-cyan-300 font-bold text-xs transition-all shadow-lg hover:shadow-cyan-500/20"
            >
              Browse Anime to Download
            </button>
          )}
        </div>
      )}
    </div>
  );
}
