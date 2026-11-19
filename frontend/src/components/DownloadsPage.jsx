import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  getAllDownloads,
  deleteDownload,
  clearAllDownloads,
  formatBytes,
  getStorageEstimate,
} from "../services/localDb.js";
import { downloadManager } from "../services/downloadManager.js";

// ─── Apple-style Icons ────────────────────────────────────────────────────────

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

function GridIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function ListIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function SortIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M6 12h12m-9 6h6" />
    </svg>
  );
}

function VideoIcon({ className = "h-4 w-4" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function CheckIcon({ className = "h-3.5 w-3.5" }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Swipeable Item Component (Apple iOS-style Swipe Actions) ────────────────

function SwipeableItem({
  children,
  onDelete,
  onDownload,
  disabled = false,
  className = "",
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const initialOffset = useRef(0);

  const ACTION_WIDTH = 144; // 72px for Save + 72px for Delete

  const handleStart = (clientX, clientY) => {
    if (disabled) return;
    touchStartX.current = clientX;
    touchStartY.current = clientY;
    initialOffset.current = offsetX;
    isSwiping.current = false;
  };

  const handleMove = (clientX, clientY) => {
    if (disabled) return;
    const diffX = clientX - touchStartX.current;
    const diffY = clientY - touchStartY.current;

    if (!isSwiping.current) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        isSwiping.current = true;
      } else {
        return;
      }
    }

    let newOffset = initialOffset.current + diffX;
    if (newOffset > 0) {
      newOffset = 0;
    }
    if (newOffset < -ACTION_WIDTH) {
      const extra = Math.abs(newOffset + ACTION_WIDTH);
      newOffset = -ACTION_WIDTH - Math.pow(extra, 0.65);
    }

    setOffsetX(newOffset);
  };

  const handleEnd = () => {
    if (disabled || !isSwiping.current) return;
    isSwiping.current = false;

    // Snap open or close
    if (offsetX < -50) {
      setOffsetX(-ACTION_WIDTH);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  };

  const close = () => {
    setOffsetX(0);
    setIsOpen(false);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background iOS Action Buttons (Revealed on Swipe Left) */}
      <div className="absolute inset-y-0 right-0 flex items-stretch z-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            close();
            onDownload?.();
          }}
          className="w-[72px] bg-[#0071e3] hover:bg-[#0077ed] active:bg-[#005bb5] text-white flex flex-col items-center justify-center gap-1.5 transition-colors select-none"
          title="Save to Device"
        >
          <DownloadIcon className="h-5 w-5" />
          <span className="text-[11px] font-semibold tracking-tight">Save</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            close();
            onDelete?.();
          }}
          className="w-[72px] bg-[#ff453a] hover:bg-[#e0382e] active:bg-[#c93027] text-white flex flex-col items-center justify-center gap-1.5 transition-colors select-none"
          title="Delete Download"
        >
          <TrashIcon className="h-5 w-5" />
          <span className="text-[11px] font-semibold tracking-tight">Delete</span>
        </button>
      </div>

      {/* Foreground Content */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping.current
            ? "none"
            : "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onTouchStart={(e) => handleStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={handleEnd}
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => {
          if (e.buttons === 1) handleMove(e.clientX, e.clientY);
        }}
        onMouseUp={handleEnd}
        onClick={() => {
          if (isOpen) close();
        }}
        className="relative z-10 w-full"
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main DownloadsPage Component ─────────────────────────────────────────────

export default function DownloadsPage({ onPlayOffline, onNavigateHome, isOffline }) {
  const [downloadQueue, setDownloadQueue] = useState([]);
  const [savedDownloads, setSavedDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedAnimeFilter, setSelectedAnimeFilter] = useState("all");
  const [storageInfo, setStorageInfo] = useState({ usage: 0, formattedUsage: "0 B" });
  const [thumbnailUrls, setThumbnailUrls] = useState({});
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem("animex_downloads_view_mode") || "grid";
    } catch (_) {
      return "grid";
    }
  });
  const [sortBy, setSortBy] = useState(() => {
    try {
      return localStorage.getItem("animex_downloads_sort_by") || "anime-asc";
    } catch (_) {
      return "anime-asc";
    }
  });

  // Batch selection states
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [packagingProgress, setPackagingProgress] = useState(null);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem("animex_downloads_view_mode", mode);
    } catch (_) {}
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    try {
      localStorage.setItem("animex_downloads_sort_by", newSort);
    } catch (_) {}
  };

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

  // Group downloads by anime title
  const animeGroups = useMemo(() => {
    const map = new Map();
    savedDownloads.forEach((it) => {
      const title = it.animeTitle || "Unknown Anime";
      map.set(title, (map.get(title) || 0) + 1);
    });
    return Array.from(map.entries()).map(([title, count]) => ({ title, count }));
  }, [savedDownloads]);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    const list = savedDownloads.filter((it) => {
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

    list.sort((a, b) => {
      if (sortBy === "anime-asc") {
        const titleComp = (a.animeTitle || "").localeCompare(b.animeTitle || "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (titleComp !== 0) return titleComp;
        const epA = Number(a.episodeNumber) || 0;
        const epB = Number(b.episodeNumber) || 0;
        if (epA !== epB) return epA - epB;
        return (a.episodeTitle || "").localeCompare(b.episodeTitle || "", undefined, { numeric: true });
      }
      if (sortBy === "anime-desc") {
        const titleComp = (b.animeTitle || "").localeCompare(a.animeTitle || "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
        if (titleComp !== 0) return titleComp;
        const epA = Number(a.episodeNumber) || 0;
        const epB = Number(b.episodeNumber) || 0;
        if (epA !== epB) return epB - epA;
        return (b.episodeTitle || "").localeCompare(a.episodeTitle || "", undefined, { numeric: true });
      }
      if (sortBy === "newest") {
        return (b.createdAt || 0) - (a.createdAt || 0);
      }
      if (sortBy === "oldest") {
        return (a.createdAt || 0) - (b.createdAt || 0);
      }
      if (sortBy === "size") {
        return (b.totalSize || 0) - (a.totalSize || 0);
      }
      return 0;
    });

    return list;
  }, [savedDownloads, selectedAnimeFilter, searchFilter, sortBy]);

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

  const toggleSelectItem = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((it) => it.id)));
    }
  };

  const handleDownloadBatchZip = async (itemsToExport = null) => {
    const list = itemsToExport || filteredItems.filter((it) => selectedIds.has(it.id));
    if (!list || list.length === 0) return;

    try {
      setPackagingProgress({
        current: 0,
        total: list.length,
        percent: 0,
        title: list[0]?.animeTitle || "Anime",
        episode: list[0]?.episodeTitle || "",
      });

      await downloadManager.exportMultipleAsZip(list, (prog) => {
        setPackagingProgress(prog);
      });
    } catch (e) {
      alert("Failed to export batch ZIP: " + e.message);
    } finally {
      setTimeout(() => setPackagingProgress(null), 1200);
    }
  };

  const handleDeleteSelected = async () => {
    const list = filteredItems.filter((it) => selectedIds.has(it.id));
    if (list.length === 0) return;
    if (window.confirm(`Delete ${list.length} selected downloaded episodes from local storage?`)) {
      for (const it of list) {
        await deleteDownload(it.id);
      }
      setSelectedIds(new Set());
      setIsSelecting(false);
      await refreshSaved();
    }
  };

  const selectedTotalSize = useMemo(() => {
    let sum = 0;
    savedDownloads.forEach((it) => {
      if (selectedIds.has(it.id)) {
        sum += it.totalSize || 0;
      }
    });
    return sum;
  }, [savedDownloads, selectedIds]);

  return (
    <div className="downloads-page max-w-7xl mx-auto w-full px-3 sm:px-6 py-6 animate-fade-in text-ivory">
      {/* ── Top Header (Apple Minimalist Glass) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Downloads</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                {savedDownloads.length} {savedDownloads.length === 1 ? "Episode" : "Episodes"}
              </span>
            </h1>

            {isOffline ? (
              <span className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                <WifiOffIcon className="h-3.5 w-3.5" />
                Offline Mode
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Online
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-ivory-muted/80 mt-1">
            Access your offline library anytime. Swipe left on any episode to Save or Delete.
          </p>
        </div>

        {/* Top Controls: Storage Info + View Toggle + Select / Clear All */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end">
          <div className="px-3.5 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-right flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-ivory-muted/70 font-mono">
              Storage
            </span>
            <span className="text-xs font-bold text-white font-mono">
              {storageInfo.formattedUsage}
            </span>
          </div>

          {/* Grid / List View Segmented Control */}
          <div className="flex items-center bg-white/[0.06] p-1 rounded-full border border-white/10">
            <button
              type="button"
              onClick={() => handleViewModeChange("grid")}
              title="Grid View"
              aria-label="Grid View"
              className={`p-1.5 rounded-full transition-all ${
                viewMode === "grid"
                  ? "bg-white text-black shadow-sm font-bold"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <GridIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange("list")}
              title="List View"
              aria-label="List View"
              className={`p-1.5 rounded-full transition-all ${
                viewMode === "list"
                  ? "bg-white text-black shadow-sm font-bold"
                  : "text-white/50 hover:text-white"
              }`}
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Select Mode Button */}
          {savedDownloads.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const nextSelecting = !isSelecting;
                setIsSelecting(nextSelecting);
                if (!nextSelecting) setSelectedIds(new Set());
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all border ${
                isSelecting
                  ? "bg-white text-black border-white font-bold shadow-md"
                  : "bg-white/[0.06] text-white/80 hover:text-white border-white/10 hover:border-white/20"
              }`}
            >
              <CheckIcon className="h-3.5 w-3.5" />
              <span>{isSelecting ? "Done" : "Select"}</span>
            </button>
          )}

          {/* Clear All Button */}
          {savedDownloads.length > 0 && !isSelecting && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3.5 py-1.5 text-xs font-semibold text-[#ff453a] hover:bg-[#ff453a]/15 border border-[#ff453a]/25 rounded-full transition-all"
              title="Delete all downloaded files to free space"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── Active Downloads Queue (Apple Activity Widget) ── */}
      {downloadQueue.length > 0 && (
        <section className="mt-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-white/90 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#0071e3] animate-pulse" />
              Active Downloads ({downloadQueue.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {downloadQueue.map((task) => (
              <div
                key={task.id}
                className="relative overflow-hidden rounded-2xl bg-white/[0.04] border border-white/10 p-3.5 backdrop-blur-2xl shadow-sm transition-all"
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
                  </div>

                  {/* Task details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <h3 className="font-semibold text-sm text-white truncate">
                          {task.animeTitle}
                        </h3>
                        <p className="text-xs text-ivory-muted truncate mt-0.5">
                          {task.episodeTitle}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadManager.cancelDownload(task.id)}
                        className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        title="Cancel download"
                      >
                        <CloseIcon className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Progress Bar (Apple Slim) */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden relative">
                        <div
                          className="h-full bg-white transition-all duration-300 rounded-full"
                          style={{ width: `${task.progress || 0}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-white/60 mt-1.5">
                        <span>
                          {task.completedChunks} / {task.totalChunks} chunks
                          {task.bytesDownloaded > 0 && ` (${formatBytes(task.bytesDownloaded)})`}
                        </span>
                        <span className="font-semibold text-white">
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

      {/* ── Filters & Search (Apple Spotlight Style) ── */}
      {savedDownloads.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-6 mb-5">
          {/* Search within downloads */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search downloads..."
              className="w-full pl-9 pr-8 py-2 bg-white/[0.06] hover:bg-white/[0.08] focus:bg-white/[0.1] border border-white/10 focus:border-white/25 rounded-full text-xs text-white placeholder-white/40 focus:outline-none transition-all backdrop-blur-xl"
            />
            <svg
              className="w-4 h-4 absolute left-3 top-2.5 text-white/40 pointer-events-none"
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

          {/* Right side: Filter Chips + Sort */}
          <div className="flex items-center gap-2 justify-between sm:justify-end flex-wrap w-full sm:w-auto">
            {animeGroups.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar max-w-full">
                <button
                  type="button"
                  onClick={() => setSelectedAnimeFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    selectedAnimeFilter === "all"
                      ? "bg-white text-black border-white font-bold shadow-sm"
                      : "bg-white/[0.05] text-white/70 hover:text-white border-white/10 hover:border-white/20"
                  }`}
                >
                  All ({savedDownloads.length})
                </button>
                {animeGroups.map(({ title, count }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => setSelectedAnimeFilter(title)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                      selectedAnimeFilter === title
                        ? "bg-white text-black border-white font-bold shadow-sm"
                        : "bg-white/[0.05] text-white/70 hover:text-white border-white/10 hover:border-white/20"
                    }`}
                  >
                    {title} ({count})
                  </button>
                ))}
              </div>
            )}

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-full border border-white/10 text-xs ml-auto sm:ml-0">
              <SortIcon className="h-3.5 w-3.5 text-white/60 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value)}
                className="bg-transparent text-white font-medium focus:outline-none cursor-pointer text-xs"
                title="Sort downloaded anime"
              >
                <option value="anime-asc" className="bg-[#1c1c1e] text-white">Title (A–Z)</option>
                <option value="anime-desc" className="bg-[#1c1c1e] text-white">Title (Z–A)</option>
                <option value="newest" className="bg-[#1c1c1e] text-white">Recently Added</option>
                <option value="oldest" className="bg-[#1c1c1e] text-white">Oldest First</option>
                <option value="size" className="bg-[#1c1c1e] text-white">File Size</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Selection Action Banner (When selecting) ── */}
      {isSelecting && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/12 backdrop-blur-2xl flex items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              {selectedIds.size === filteredItems.length && filteredItems.length > 0
                ? "Deselect All"
                : "Select All"}
            </button>
            <span className="text-xs text-white/80 font-medium">
              <strong className="text-white font-bold">{selectedIds.size}</strong> of{" "}
              {filteredItems.length} selected
              {selectedTotalSize > 0 && (
                <span className="text-white/60 font-mono ml-1.5">
                  ({formatBytes(selectedTotalSize)})
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Download Selected Option */}
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={() => handleDownloadBatchZip()}
              className="px-3.5 py-1.5 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Download selected as ZIP archive"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              <span>Download ({selectedIds.size})</span>
            </button>

            {/* Delete Selected Option */}
            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
              className="px-3.5 py-1.5 rounded-full bg-[#ff453a]/20 hover:bg-[#ff453a]/30 text-[#ff453a] border border-[#ff453a]/40 font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Delete selected episodes"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              <span>Delete ({selectedIds.size})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Downloaded Items (Grid or List View with Swipe Gestures) ── */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-ivory-muted gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <p className="text-xs">Loading offline library…</p>
        </div>
      ) : filteredItems.length > 0 ? (
        viewMode === "grid" ? (
          /* ── Grid View ── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map((item) => {
              const thumbSrc = thumbnailUrls[item.id] || item.thumbnail;
              const hasSubs = Array.isArray(item.subtitles) && item.subtitles.length > 0;
              const isSelected = selectedIds.has(item.id);

              return (
                <SwipeableItem
                  key={item.id}
                  disabled={isSelecting}
                  onDelete={() => handleDelete(item.id, `${item.animeTitle} - ${item.episodeTitle}`)}
                  onDownload={() => downloadManager.saveToDevice(item)}
                  className="rounded-3xl"
                >
                  <div
                    onClick={isSelecting ? () => toggleSelectItem(item.id) : undefined}
                    className={`group relative rounded-3xl bg-white/[0.04] hover:bg-white/[0.07] border overflow-hidden flex flex-col transition-all duration-300 backdrop-blur-xl ${
                      isSelected
                        ? "border-white ring-2 ring-white/50 bg-white/[0.09]"
                        : "border-white/10 hover:border-white/20 shadow-sm"
                    } ${isSelecting ? "cursor-pointer" : ""}`}
                  >
                    {/* iOS Selection Checkbox */}
                    {isSelecting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(item.id);
                        }}
                        className={`absolute top-3 left-3 z-30 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-[#0071e3] border-[#0071e3] text-white shadow-md scale-105"
                            : "bg-black/50 border border-white/40 text-transparent hover:border-white"
                        }`}
                        title={isSelected ? "Deselect" : "Select"}
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Poster / Thumbnail Header */}
                    <div className="relative aspect-video w-full overflow-hidden bg-black/50">
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={item.animeTitle}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <DownloadIcon className="h-10 w-10" />
                        </div>
                      )}

                      {/* Overlays */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

                      {/* Primary Play Button */}
                      {!isSelecting && (
                        <button
                          type="button"
                          onClick={() => onPlayOffline(item)}
                          className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-all z-10"
                          title="Play Offline Video"
                        >
                          <PlayIcon className="h-5 w-5 ml-0.5" />
                        </button>
                      )}

                      {/* Frosted Badges */}
                      <div className={`absolute top-3 ${isSelecting ? "left-12" : "left-3"} flex items-center gap-1.5 flex-wrap transition-all`}>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/90 border border-white/15">
                          {item.quality || "Standard"}
                        </span>
                        {hasSubs && (
                          <span className="text-[10px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-emerald-300 border border-white/15">
                            <SubtitleIcon className="h-3 w-3" />
                            Subs ({item.subtitles.length})
                          </span>
                        )}
                      </div>

                      {item.platform && (
                        <span className="absolute top-3 right-3 text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white/70 border border-white/10">
                          {item.platform}
                        </span>
                      )}

                      {/* Bottom Info on Poster */}
                      <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between text-[11px] font-mono text-white/90">
                        <span>{formatBytes(item.totalSize || 0)}</span>
                        {item.duration > 0 && (
                          <span>{Math.floor(item.duration / 60)} min</span>
                        )}
                      </div>
                    </div>

                    {/* Details & Actions Body */}
                    <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-sm text-white line-clamp-1 tracking-tight">
                          {item.animeTitle}
                        </h3>
                        <p className="text-xs text-ivory-muted/80 line-clamp-1 mt-0.5">
                          {item.episodeTitle || `Episode ${item.episodeNumber}`}
                        </p>
                        <p className="text-[10px] font-mono text-white/40 mt-1">
                          Downloaded {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                        </p>
                      </div>

                      {/* Action Buttons Row */}
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => onPlayOffline(item)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-full bg-white text-black hover:bg-white/90 font-semibold text-xs transition-all shadow-sm active:scale-98"
                        >
                          <PlayIcon className="h-3.5 w-3.5" />
                          <span>Play</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => downloadManager.saveToDevice(item)}
                          className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-all border border-white/10"
                          title={hasSubs ? "Save Video & Subtitles (.zip)" : "Save Video (.mp4)"}
                        >
                          <DownloadIcon className="h-3.5 w-3.5" />
                        </button>

                        {hasSubs && (
                          <button
                            type="button"
                            onClick={() => downloadManager.saveToDevice(item, { videoOnly: true })}
                            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-all border border-white/10 hidden sm:flex items-center justify-center"
                            title="Save Video Only (.mp4)"
                          >
                            <VideoIcon className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {hasSubs && (
                          <button
                            type="button"
                            onClick={() => downloadManager.saveSubtitleToDevice(item, 0)}
                            className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-emerald-300/80 hover:text-emerald-200 transition-all border border-white/10"
                            title="Export Subtitles (.srt)"
                          >
                            <SubtitleIcon className="h-3.5 w-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDelete(item.id, `${item.animeTitle} - ${item.episodeTitle}`)}
                          className="p-2 rounded-full bg-white/[0.04] hover:bg-[#ff453a]/20 text-white/40 hover:text-[#ff453a] transition-all border border-white/5 hover:border-[#ff453a]/30"
                          title="Delete from local database"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </SwipeableItem>
              );
            })}
          </div>
        ) : (
          /* ── List View (Apple iOS Files / Music Row Style with Swipe Gestures) ── */
          <div className="flex flex-col gap-2.5">
            {filteredItems.map((item) => {
              const thumbSrc = thumbnailUrls[item.id] || item.thumbnail;
              const hasSubs = Array.isArray(item.subtitles) && item.subtitles.length > 0;
              const isSelected = selectedIds.has(item.id);

              return (
                <SwipeableItem
                  key={item.id}
                  disabled={isSelecting}
                  onDelete={() => handleDelete(item.id, `${item.animeTitle} - ${item.episodeTitle}`)}
                  onDownload={() => downloadManager.saveToDevice(item)}
                  className="rounded-2xl"
                >
                  <div
                    onClick={isSelecting ? () => toggleSelectItem(item.id) : undefined}
                    className={`group relative rounded-2xl bg-white/[0.04] hover:bg-white/[0.07] border p-2 sm:p-3 flex flex-row items-center gap-3 transition-all duration-300 backdrop-blur-xl ${
                      isSelected
                        ? "border-white ring-2 ring-white/50 bg-white/[0.09]"
                        : "border-white/10 hover:border-white/20 shadow-sm"
                    } ${isSelecting ? "cursor-pointer" : ""}`}
                  >
                    {/* iOS Selection Checkbox */}
                    {isSelecting && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectItem(item.id);
                        }}
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-[#0071e3] border-[#0071e3] text-white shadow-md scale-105"
                            : "bg-black/50 border border-white/40 text-transparent hover:border-white"
                        }`}
                        title={isSelected ? "Deselect" : "Select"}
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {/* Thumbnail with Play Overlay */}
                    <div className="relative w-24 xs:w-28 sm:w-40 aspect-video rounded-xl overflow-hidden bg-black/50 shrink-0">
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={item.animeTitle}
                          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20">
                          <DownloadIcon className="h-6 w-6" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                      {!isSelecting && (
                        <button
                          type="button"
                          onClick={() => onPlayOffline(item)}
                          className="absolute inset-0 m-auto w-8 h-8 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-all z-10"
                          title="Play Offline Video"
                        >
                          <PlayIcon className="h-4 w-4 ml-0.5" />
                        </button>
                      )}

                      {item.duration > 0 && (
                        <span className="absolute bottom-1 right-1.5 text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-black/75 backdrop-blur-md text-white/90">
                          {Math.floor(item.duration / 60)}m
                        </span>
                      )}
                    </div>

                    {/* Middle Details */}
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center gap-2 mb-0.5 text-[10px] font-mono text-white/60">
                        {item.platform && (
                          <span className="px-1.5 py-0.2 rounded-full bg-white/10 text-white/80">
                            {item.platform}
                          </span>
                        )}
                        <span className="text-white/80 font-medium font-mono">
                          {formatBytes(item.totalSize || 0)}
                        </span>
                        <span className="hidden xs:inline">•</span>
                        <span className="hidden xs:inline">
                          {new Date(item.createdAt || Date.now()).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="font-semibold text-xs sm:text-sm text-white truncate tracking-tight">
                        {item.animeTitle}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-ivory-muted/80 truncate mt-0.5">
                        {item.episodeTitle || `Episode ${item.episodeNumber}`}
                      </p>

                      {hasSubs && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-400/90">
                          <SubtitleIcon className="h-2.5 w-2.5" />
                          <span>Subtitles ({item.subtitles.length})</span>
                        </div>
                      )}
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onPlayOffline(item)}
                        className="flex items-center justify-center gap-1 py-1.5 px-3 rounded-full bg-white text-black hover:bg-white/90 font-semibold text-xs transition-all shadow-sm"
                        title="Play Offline"
                      >
                        <PlayIcon className="h-3 w-3" />
                        <span className="hidden sm:inline">Play</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => downloadManager.saveToDevice(item)}
                        className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-all border border-white/10"
                        title="Save to Device"
                      >
                        <DownloadIcon className="h-3.5 w-3.5" />
                      </button>

                      {hasSubs && (
                        <button
                          type="button"
                          onClick={() => downloadManager.saveToDevice(item, { videoOnly: true })}
                          className="p-2 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-white/80 hover:text-white transition-all border border-white/10 hidden md:flex"
                          title="Save Video Only (.mp4)"
                        >
                          <VideoIcon className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, `${item.animeTitle} - ${item.episodeTitle}`)}
                        className="p-2 rounded-full bg-white/[0.04] hover:bg-[#ff453a]/20 text-white/40 hover:text-[#ff453a] transition-all border border-white/5 hover:border-[#ff453a]/30"
                        title="Delete Download"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </SwipeableItem>
              );
            })}
          </div>
        )
      ) : savedDownloads.length > 0 ? (
        /* Empty Filter Results */
        <div className="py-20 text-center text-ivory-muted">
          <p className="text-sm">No downloads matching &ldquo;{searchFilter}&rdquo;.</p>
          <button
            type="button"
            onClick={() => {
              setSearchFilter("");
              setSelectedAnimeFilter("all");
            }}
            className="mt-3 text-xs text-white underline hover:text-white/80 font-medium"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Empty State (Apple Style) */
        <div className="py-20 sm:py-28 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto text-white/40 mb-4 shadow-lg backdrop-blur-xl">
            <DownloadIcon className="h-7 w-7" />
          </div>

          <h3 className="text-lg font-bold text-white mb-1.5 tracking-tight">
            {isOffline ? "You are offline" : "No Downloads"}
          </h3>

          <p className="text-xs text-ivory-muted/80 leading-relaxed mb-6">
            {isOffline
              ? "No downloaded episodes found for offline viewing. Reconnect to browse and download your favorite series."
              : "Download anime episodes and regional dubbed streams to watch offline with full audio and subtitle tracks."}
          </p>

          {!isOffline && onNavigateHome && (
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-5 py-2.5 rounded-full bg-white text-black hover:bg-white/90 font-semibold text-xs transition-all shadow-md active:scale-98"
            >
              Browse Anime
            </button>
          )}
        </div>
      )}

      {/* ── Apple Dynamic Island Floating Batch Action Bar ── */}
      {isSelecting && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[calc(100%-2rem)] mx-auto animate-slide-up">
          <div className="bg-[#1c1c1e]/90 backdrop-blur-3xl border border-white/15 rounded-full px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3">
            {/* Left: Select count + Select All */}
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white shrink-0 transition-colors"
              >
                {selectedIds.size === filteredItems.length && filteredItems.length > 0
                  ? "Deselect"
                  : "All"}
              </button>
              <div className="truncate text-xs">
                <span className="font-bold text-white">
                  {selectedIds.size}
                </span>
                <span className="text-white/60"> / {filteredItems.length}</span>
                {selectedTotalSize > 0 && (
                  <span className="text-white/50 font-mono hidden sm:inline ml-1">
                    ({formatBytes(selectedTotalSize)})
                  </span>
                )}
              </div>
            </div>

            {/* Right: Both Download AND Delete Options */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Option 1: Download Selected */}
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => handleDownloadBatchZip()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#0071e3] hover:bg-[#0077ed] text-white transition-all shadow-md active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Download selected episodes as a single ZIP archive"
              >
                <DownloadIcon className="h-3.5 w-3.5" />
                <span>Download ({selectedIds.size})</span>
              </button>

              {/* Option 2: Delete Selected */}
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#ff453a]/20 hover:bg-[#ff453a]/30 text-[#ff453a] border border-[#ff453a]/40 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                title="Delete selected episodes from offline storage"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span>Delete ({selectedIds.size})</span>
              </button>

              {/* Exit selection */}
              <button
                type="button"
                onClick={() => {
                  setIsSelecting(false);
                  setSelectedIds(new Set());
                }}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                title="Exit selection mode"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Packaging ZIP Progress Modal (Apple Dialog Style) ── */}
      {packagingProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-[#1c1c1e] border border-white/15 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl backdrop-blur-3xl">
            <div className="w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
              <DownloadIcon className="h-6 w-6 animate-pulse" />
            </div>
            <h4 className="font-bold text-base text-white mb-1 tracking-tight">Exporting ZIP Archive</h4>
            <p className="text-xs text-ivory-muted truncate mb-4">
              {packagingProgress.title} {packagingProgress.episode ? `• ${packagingProgress.episode}` : ""}
            </p>
            <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden mb-2 relative">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${packagingProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-white/60">
              <span>Episode {packagingProgress.current} of {packagingProgress.total}</span>
              <span className="font-bold text-white">{packagingProgress.percent}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
