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

const ExitFullscreenIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
  </svg>
);

const WarningIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-8 h-8"
    aria-hidden="true"
  >
    <path d="m10.3 3.8-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4m0 4h.01" />
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

export default function Player({
  streamUrl,
  subtitles = [],
  title,
  initialTime = 0,
  onTimeUpdate,
  onClose,
  onError,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const wrapperRef = useRef(null);
  const initialTimeRef = useRef(initialTime);

  useEffect(() => {
    initialTimeRef.current = initialTime;
  }, [initialTime]);

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
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [subtitleSources, setSubtitleSources] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sources = subtitles.map((subtitle) => {
      if (typeof subtitle.content === "string" && subtitle.content.length > 0) {
        return URL.createObjectURL(
          new Blob([subtitle.content], { type: "text/vtt;charset=utf-8" })
        );
      }
      return subtitle.proxyUrl || "";
    });
    setSubtitleSources(sources);

    return () => {
      sources.forEach((source) => {
        if (source.startsWith("blob:")) URL.revokeObjectURL(source);
      });
    };
  }, [subtitles]);

  // Auto-select English or default subtitle
  useEffect(() => {
    if (!subtitles || subtitles.length === 0) {
      setActiveSubtitle(-1);
      return;
    }
    let defaultIdx = subtitles.findIndex((s) => s.default);
    if (defaultIdx === -1) {
      defaultIdx = subtitles.findIndex((s) =>
        s.label?.toLowerCase().includes("english")
      );
    }
    if (defaultIdx === -1) defaultIdx = 0;
    setActiveSubtitle(defaultIdx);
  }, [subtitles]);

  // Synchronize subtitle track mode on video element
  useEffect(() => {
    if (!videoRef.current) return;
    const textTracks = videoRef.current.textTracks;
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = i === activeSubtitle ? "showing" : "disabled";
    }
  }, [activeSubtitle]);

  const handleSubtitleChange = useCallback((index) => {
    setActiveSubtitle(index);
    if (!videoRef.current) return;
    const textTracks = videoRef.current.textTracks;
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = i === index ? "showing" : "disabled";
    }
  }, []);

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
        if (initialTimeRef.current > 0) {
          video.currentTime = initialTimeRef.current;
        }
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
        if (initialTimeRef.current > 0) {
          video.currentTime = initialTimeRef.current;
        }
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
        if (!seeking) {
          patchState({ currentTime: video.currentTime });
          onTimeUpdate?.(video.currentTime);
        }
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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const syncFullscreenState = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            document.webkitFullscreenElement ||
            video.webkitDisplayingFullscreen
        )
      );
    };
    const handleNativeFullscreenEnd = () => {
      video.controls = false;
      syncFullscreenState();
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    video.addEventListener("webkitbeginfullscreen", syncFullscreenState);
    video.addEventListener("webkitendfullscreen", handleNativeFullscreenEnd);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
      video.removeEventListener("webkitbeginfullscreen", syncFullscreenState);
      video.removeEventListener("webkitendfullscreen", handleNativeFullscreenEnd);
    };
  }, []);

  const handleFullscreen = useCallback(async () => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video) return;

    if (video.webkitDisplayingFullscreen) {
      video.webkitExitFullscreen?.();
      return;
    }

    const fullscreenElement =
      document.fullscreenElement || document.webkitFullscreenElement;
    if (fullscreenElement) {
      const exitFullscreen =
      document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.webkitCancelFullScreen;
      if (exitFullscreen) {
        try {
          await exitFullscreen.call(document);
        } catch (error) {
          onError?.(`Unable to exit fullscreen: ${error.message}`);
        }
      }
      return;
    }

    const enterNativeVideoFullscreen = () => {
      if (typeof video.webkitEnterFullscreen !== "function") return false;
      try {
        video.controls = true;
        video.webkitEnterFullscreen();
        return true;
      } catch {
        video.controls = false;
        return false;
      }
    };

    if (typeof wrapper.requestFullscreen === "function") {
      try {
        await wrapper.requestFullscreen({ navigationUI: "hide" });
        return;
      } catch (error) {
        if (enterNativeVideoFullscreen()) return;
        onError?.(`Unable to enter fullscreen: ${error.message}`);
        return;
      }
    }

    const webkitRequestFullscreen =
      wrapper.webkitRequestFullscreen || wrapper.webkitRequestFullScreen;
    if (typeof webkitRequestFullscreen === "function") {
      try {
        webkitRequestFullscreen.call(wrapper);
        return;
      } catch (error) {
        if (enterNativeVideoFullscreen()) return;
        onError?.(`Unable to enter fullscreen: ${error.message}`);
        return;
      }
    }

    if (!enterNativeVideoFullscreen()) {
      onError?.("Fullscreen is not supported by this browser.");
    }
  }, [onError]);

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
          if (
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            videoRef.current?.webkitDisplayingFullscreen
          ) {
            handleFullscreen();
          } else {
            onClose?.();
          }
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
      className={`player-wrapper animate-fade-in ${isFullscreen ? "is-fullscreen" : ""}`}
      onMouseMove={showControls}
      onMouseLeave={() => playing && setControlsVisible(false)}
      onTouchStart={showControls}
      style={{ cursor: controlsVisible ? "default" : "none" }}
    >
      {/* ── Title bar ── */}
      <div
        className="player-title-bar px-4 py-2.5 flex items-center justify-between"
      >
        <span className="text-ivory font-semibold text-sm line-clamp-1 max-w-[75%]">
          {title}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="player-control-button"
            title="Close player (Esc)"
            aria-label="Close player"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="player-video-stage">
        <video
          ref={videoRef}
          className="w-full bg-black"
          playsInline
          crossOrigin="anonymous"
          onClick={() => {
            showControls();
            togglePlay();
          }}
          onDoubleClick={handleFullscreen}
        >
          {subtitles.map((sub, i) => (
            <track
              key={sub.proxyUrl || i}
              kind="subtitles"
              src={subtitleSources[i] || undefined}
              srcLang={sub.lang || "en"}
              label={sub.label}
              default={activeSubtitle === i}
              onLoad={() => {
                const track = videoRef.current?.textTracks[i];
                if (track) {
                  track.mode = i === activeSubtitle ? "showing" : "disabled";
                }
              }}
            />
          ))}
        </video>

        {loading && !hlsError && (
          <div className="absolute inset-0 flex items-center justify-center bg-navy-900/70 backdrop-blur-sm">
            <LoadingSpinner />
          </div>
        )}

        {hlsError && (
          <div className="hls-error animate-fade-in">
            <div className="mb-3 text-red-400">
              <WarningIcon />
            </div>
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
      </div>

      <div
        className="player-controls player-control-dock"
        style={{
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      >
        {/* Progress bar with buffered track */}
        <div className="relative mb-2 group">
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
            onTouchStart={handleSeekStart}
            style={{
              background: `linear-gradient(to right, #E8EAED ${progressPct}%, rgba(255,255,255,0.15) ${progressPct}%)`,
            }}
          />
        </div>

        {/* Button row */}
        <div className="player-control-row flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="player-control-button player-play-button"
            title={playing ? "Pause (Space)" : "Play (Space)"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              className="player-control-button"
              title="Toggle mute (M)"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              <VolumeIcon muted={muted} />
            </button>
            <input
              type="range"
              className="seek-bar player-volume"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              title="Volume"
            />
          </div>

          {/* Timestamp */}
          <span className="player-time text-ivory-muted text-xs font-mono ml-1 tabular-nums">
            {fmtTime(currentTime)} / {fmtTime(duration)}
          </span>

          {/* Spacer */}
          <div className="player-control-spacer flex-1" />

          {/* Subtitle (CC) selector */}
          {subtitles.length > 0 && (
            <div className="player-extra-control flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-gold/40 text-gold bg-gold/10">
                CC
              </span>
              <select
                value={activeSubtitle}
                onChange={(e) => handleSubtitleChange(parseInt(e.target.value))}
                className="bg-navy-900/80 text-ivory text-xs rounded-lg px-2 py-1
                           border border-white/10 outline-none cursor-pointer
                           hover:border-gold/40 transition-colors max-w-[130px] truncate"
                title="Subtitles"
              >
                <option value={-1}>Off</option>
                {subtitles.map((sub, idx) => (
                  <option key={sub.proxyUrl || idx} value={idx}>
                    {sub.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quality selector */}
          {levels.length > 1 && (
            <div className="player-extra-control relative">
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
            className="player-control-button"
            title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>

      {/* ── Keyboard hint (shown briefly on mount) ── */}
      <div className="player-keyboard-hint text-xs text-ivory-muted/60 font-mono pointer-events-none">
        Space · ←→ 10s · M mute · F fullscreen · Esc close
      </div>
    </div>
  );
}
