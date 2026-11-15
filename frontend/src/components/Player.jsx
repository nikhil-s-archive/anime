/**
 * Player.jsx — HLS.js video player with custom controls
 *
 * Props:
 *   streamUrl  {string}         — Proxied /proxy/hls?url=... URL
 *   title      {string}         — Display title overlay
 *   onClose    {() => void}     — Callback to dismiss the player
 *   onError    {(msg) => void}  — Error callback
 */
import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

// ─── Icons (inline SVG to avoid icon library dependency) ─────────────────────

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const VolumeIcon = ({ muted }) =>
  muted ? (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.73 1.73L21 18.46 5.54 3 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );

const FullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center gap-3">
    <div
      className="w-12 h-12 rounded-full border-4 border-gold/20 border-t-gold animate-spin"
      aria-label="Loading"
    />
    <p className="text-ivory-muted text-sm">Loading stream…</p>
  </div>
);

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtTime(secs) {
  if (!isFinite(secs) || isNaN(secs)) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Player({ streamUrl, title, onClose, onError }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const wrapperRef = useRef(null);

  const [playerState, setPlayerState] = useState({
    playing: false,
    muted: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    buffered: 0,
    loading: true,
    hlsError: null,
    levels: [],       // available quality levels
    activeLevel: -1,  // -1 = auto
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);

  // Convenience updater
  const patchState = useCallback((patch) => {
    setPlayerState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── HLS Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    // Teardown previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    patchState({ loading: true, hlsError: null, playing: false });

    if (Hls.isSupported()) {
      const hls = new Hls({
        // Aggressive retry config for proxy latency
        maxLoadingDelay: 10,
        maxMaxBufferLength: 60,
        startLevel: -1,              // auto quality
        abrEwmaDefaultEstimate: 2e6, // start at 2 Mbps
        enableWorker: true,
        lowLatencyMode: false,
        // Progressive fragment loading for faster start
        progressive: true,
        backBufferLength: 30,
        // Retry on network errors
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        patchState({
          loading: false,
          levels: data.levels.map((l, i) => ({
            index: i,
            label: l.height ? `${l.height}p` : `Level ${i}`,
            bitrate: l.bitrate,
          })),
          activeLevel: -1,
        });
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, { level }) => {
        patchState({ activeLevel: level });
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn("[HLS] Network error, attempting recovery…");
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn("[HLS] Media error, attempting recovery…");
              hls.recoverMediaError();
              break;
            default:
              const msg = `Fatal HLS error: ${data.details}`;
              patchState({ hlsError: msg, loading: false });
              onError?.(msg);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = streamUrl;
      video.addEventListener("loadedmetadata", () => {
        patchState({ loading: false });
        video.play().catch(() => {});
      }, { once: true });
    } else {
      const msg = "HLS is not supported in this browser.";
      patchState({ hlsError: msg, loading: false });
      onError?.(msg);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play:          () => patchState({ playing: true }),
      pause:         () => patchState({ playing: false }),
      waiting:       () => patchState({ loading: true }),
      canplay:       () => patchState({ loading: false }),
      durationchange:() => patchState({ duration: video.duration }),
      volumechange:  () => patchState({ volume: video.volume, muted: video.muted }),
      timeupdate: () => {
        if (!seeking) patchState({ currentTime: video.currentTime });
        // Update buffered amount
        if (video.buffered.length > 0) {
          patchState({ buffered: video.buffered.end(video.buffered.length - 1) });
        }
      },
    };

    Object.entries(handlers).forEach(([ev, fn]) => video.addEventListener(ev, fn));
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => video.removeEventListener(ev, fn));
    };
  }, [seeking, patchState]);

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playerState.playing) setControlsVisible(false);
    }, 3000);
  }, [playerState.playing]);

  useEffect(() => () => clearTimeout(controlsTimerRef.current), []);

  // ── Control handlers ───────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  }, []);

  const handleVolumeChange = useCallback((e) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = parseFloat(e.target.value);
    video.muted = video.volume === 0;
  }, []);

  const handleSeekStart = useCallback(() => setSeeking(true), []);

  const handleSeekChange = useCallback((e) => {
    patchState({ currentTime: parseFloat(e.target.value) });
  }, [patchState]);

  const handleSeekEnd = useCallback((e) => {
    const video = videoRef.current;
    if (video) video.currentTime = parseFloat(e.target.value);
    setSeeking(false);
  }, []);

  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  }, []);

  const handleQualityChange = useCallback((levelIndex) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = levelIndex;
    patchState({ activeLevel: levelIndex });
  }, [patchState]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          showControls();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          handleFullscreen();
          break;
        case "ArrowRight":
          if (videoRef.current) videoRef.current.currentTime += 10;
          showControls();
          break;
        case "ArrowLeft":
          if (videoRef.current) videoRef.current.currentTime -= 10;
          showControls();
          break;
        case "ArrowUp":
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case "ArrowDown":
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case "Escape":
          onClose?.();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, handleFullscreen, showControls, onClose]);

  // ── Progress bar fill widths ───────────────────────────────────────────────
  const { duration, currentTime, buffered, playing, muted, volume,
          loading, hlsError, levels, activeLevel } = playerState;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      className="player-wrapper animate-fade-in"
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      style={{ cursor: controlsVisible ? "default" : "none" }}
    >
      {/* ── Video element ── */}
      <video
        ref={videoRef}
        className="w-full max-h-[70vh] bg-black"
        playsInline
        onClick={togglePlay}
        onDoubleClick={handleFullscreen}
      />

      {/* ── Loading overlay ── */}
      {loading && !hlsError && (
        <div className="absolute inset-0 flex items-center justify-center bg-navy-900/70 backdrop-blur-sm">
          <LoadingSpinner />
        </div>
      )}

      {/* ── Error overlay ── */}
      {hlsError && (
        <div className="hls-error animate-fade-in">
          <div className="text-red-400 text-4xl mb-3">⚠️</div>
          <p className="text-ivory font-semibold mb-1">Stream Error</p>
          <p className="text-ivory-muted text-sm text-center max-w-xs">{hlsError}</p>
          <button
            onClick={() => { patchState({ hlsError: null, loading: true }); }}
            className="btn-gold mt-4 text-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Title bar (top) ── */}
      <div
        className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between"
        style={{
          background: "linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)",
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <span className="text-ivory font-semibold text-sm line-clamp-1 max-w-[75%]">
          {title}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-ivory-muted hover:text-gold transition-colors p-1 rounded-lg hover:bg-white/10"
            title="Close player (Esc)"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* ── Controls (bottom) ── */}
      <div
        className="player-controls"
        style={{
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        {/* Progress bar with buffered track */}
        <div className="relative mb-3 group">
          {/* Buffered indicator */}
          <div
            className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-white/20 pointer-events-none"
            style={{ width: `${bufferedPct}%` }}
          />
          <input
            type="range"
            className="seek-bar relative z-10"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onMouseDown={handleSeekStart}
            onChange={handleSeekChange}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            style={{
              background: `linear-gradient(to right, #C9A24B ${progressPct}%, rgba(255,255,255,0.15) ${progressPct}%)`,
            }}
          />
        </div>

        {/* Button row */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-ivory hover:text-gold transition-colors"
            title={playing ? "Pause (Space)" : "Play (Space)"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="text-ivory-muted hover:text-gold transition-colors"
              title="Toggle mute (M)"
            >
              <VolumeIcon muted={muted} />
            </button>
            <input
              type="range"
              className="seek-bar w-20"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              title="Volume"
            />
          </div>

          {/* Timestamp */}
          <span className="text-ivory-muted text-xs font-mono ml-1 tabular-nums">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quality selector */}
          {levels.length > 1 && (
            <div className="relative">
              <select
                value={activeLevel}
                onChange={(e) => handleQualityChange(parseInt(e.target.value))}
                className="bg-navy-900/80 text-ivory text-xs rounded-lg px-2 py-1
                           border border-white/10 outline-none cursor-pointer
                           hover:border-gold/40 transition-colors"
                title="Quality"
              >
                <option value={-1}>Auto</option>
                {levels.map((l) => (
                  <option key={l.index} value={l.index}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="text-ivory-muted hover:text-gold transition-colors"
            title="Fullscreen (F)"
          >
            <FullscreenIcon />
          </button>
        </div>
      </div>

      {/* ── Keyboard hint (shown briefly on mount) ── */}
      <div className="absolute bottom-20 right-4 text-xs text-ivory-muted/60 font-mono pointer-events-none">
        Space · ←→ 10s · M mute · F fullscreen · Esc close
      </div>
    </div>
  );
}
