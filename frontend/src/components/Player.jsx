/**
 * Player.jsx — Liquid Glass UI Video Player
 * Inspired by https://github.com/b4-behroz/Liquid-Glass-UI-Video-Player
 *
 * Features:
 *   - Liquid Glass UI with SVG fractal distortion (#glass-distortion)
 *   - Center controls (Seek 10s back, Reload, Large Center Play, Seek 10s forward)
 *   - Bottom controls with sleek progress bar, hover timestamp tooltip
 *   - Vertical capsule volume slider tray
 *   - Liquid glass time display capsule
 *   - Liquid glass right controls capsule (Settings, CC Subtitles, PiP, Fullscreen)
 *   - Glassmorphic flyout settings panel (Quality, Speed, Subtitles, Audio/Servers)
 *   - Full keyboard shortcuts & touch support
 *   - HLS.js streaming with error recovery & Safari native HLS fallback
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const PlayIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
  </svg>
);

const SeekBackIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="currentColor" className={className}>
    <path d="M28 54.4c13.05 0 23.9-10.83 23.9-23.9 0-11.54-8.43-21.31-19.38-23.47v-3.33c0-1.66-1.15-2.11-2.44-1.2l-7.48 5.23c-1.05.75-1.07 1.88 0 2.65l7.45 5.25c1.32.94 2.47.49 2.47-1.2v-3.35c8.86 2.01 15.37 9.91 15.37 19.4a19.84 19.84 0 0 1-19.89 19.89c-11.06 0-19.94-8.86-19.92-19.92.02-6.66 3.26-12.54 8.25-16.1 1-.73 1.27-1.83.66-2.82-.56-.96-1.85-1.22-2.89-.42C8.06 15.54 4.1 22.62 4.1 30.5c0 13.08 10.82 23.9 23.9 23.9m5.65-14.04c3.89 0 6.45-3.68 6.45-9.3 0-5.68-2.56-9.4-6.45-9.4s-6.45 3.72-6.45 9.4c0 5.62 2.56 9.3 6.45 9.3m-12.21-.28c.91 0 1.5-.63 1.5-1.62V23.72c0-1.15-.61-1.87-1.67-1.87-.63 0-1.08.21-1.92.77l-3.26 2.18c-.51.38-.77.8-.77 1.36 0 .78.61 1.43 1.36 1.43.45 0 .66-.09 1.13-.42l2.18-1.6v12.9c0 .96.58 1.61 1.45 1.61m12.21-2.56c-2.06 0-3.4-2.46-3.4-6.46 0-4.08 1.32-6.57 3.4-6.57 2.11 0 3.38 2.46 3.38 6.57 0 4-1.29 6.46-3.38 6.46" />
  </svg>
);

const SeekForwardIcon = ({ className = "w-6 h-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="currentColor" className={className}>
    <path d="M28 54.4c-13.05 0-23.9-10.83-23.9-23.9 0-11.54 8.43-21.31 19.38-23.47v-3.33c0-1.66 1.15-2.11 2.44-1.2l7.48 5.23c1.05.75 1.07 1.88 0 2.65l-7.45 5.25c-1.32.94-2.47.49-2.47-1.2v-3.35c-8.86 2.01-15.37 9.91-15.37 19.4a19.84 19.84 0 0 0 19.89 19.89c11.06 0 19.94-8.86 19.92-19.92-.02-6.66-3.26-12.54-8.25-16.1-1-.73-1.27-1.83-.66-2.82.56-.96 1.85-1.22 2.89-.42C47.94 15.54 51.9 22.62 51.9 30.5c0 13.08-10.82 23.9-23.9 23.9m-5.65-14.04c-3.89 0-6.45-3.68-6.45-9.3 0-5.68 2.56-9.4 6.45-9.4s6.45 3.72 6.45 9.4c0 5.62-2.56 9.3-6.45 9.3m12.21-.28c-.91 0-1.5-.63-1.5-1.62V23.72c0-1.15.61-1.87 1.67-1.87.63 0 1.08.21 1.92.77l3.26 2.18c.51.38.77.8.77 1.36 0 .78-.61 1.43-1.36 1.43-.45 0-.66-.09-1.13-.42l-2.18-1.6v12.9c0 .96-.58 1.61-1.45 1.61m-12.21-2.56c2.06 0 3.4-2.46 3.4-6.46 0-4.08-1.32-6.57-3.4-6.57-2.11 0-3.38 2.46-3.38 6.57 0 4 1.29 6.46 3.38 6.46" />
  </svg>
);

const RefreshIcon = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 240 240" fill="currentColor" className={className}>
    <path d="M120,41.9v-20c0-5-4-8-8-4l-44,28a5.865,5.865,0,0,0-3.3,7.6A5.943,5.943,0,0,0,68,56.8l43,29c5,4,9,1,9-4v-20a60,60,0,1,1-60,60H40a80,80,0,1,0,80-79.9Z" />
  </svg>
);

const VolumeHighIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
  </svg>
);

const VolumeLowIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
  </svg>
);

const VolumeMuteIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l1.73 1.73L21 18.46 5.54 3 4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
  </svg>
);

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
  </svg>
);

const PipIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4" />
    <rect width="10" height="7" x="12" y="13" rx="2" fill="currentColor" fillOpacity="0.2" />
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

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
);

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtTime(secs) {
  if (!Number.isFinite(secs) || isNaN(secs) || secs < 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function Player({
  streamUrl,
  subtitles = [],
  title = "",
  initialTime = 0,
  onTimeUpdate,
  onClose,
  onError,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wrapperRef = useRef(null);
  const controlsTimerRef = useRef(null);
  const progressBarRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const settingsPanelRef = useRef(null);
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
    levels: [],
    activeLevel: -1,
    playbackRate: 1,
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isVolumeDragging, setIsVolumeDragging] = useState(false);

  const patchState = useCallback((patch) => {
    setPlayerState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Show / Hide Controls ───────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playerState.playing && !showSettings) {
        setControlsVisible(false);
      }
    }, 3200);
  }, [playerState.playing, showSettings]);

  useEffect(() => {
    return () => clearTimeout(controlsTimerRef.current);
  }, []);

  // ── Subtitles Auto Selection ───────────────────────────────────────────────
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

  useEffect(() => {
    if (!videoRef.current) return;
    const textTracks = videoRef.current.textTracks;
    for (let i = 0; i < textTracks.length; i++) {
      textTracks[i].mode = i === activeSubtitle ? "showing" : "disabled";
    }
  }, [activeSubtitle]);

  // ── HLS Setup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    patchState({ loading: true, hlsError: null, playing: false });

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxLoadingDelay: 10,
        maxMaxBufferLength: 60,
        startLevel: -1,
        abrEwmaDefaultEstimate: 2e6,
        enableWorker: true,
        lowLatencyMode: false,
        progressive: true,
        backBufferLength: 30,
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
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              const msg = `Stream error: ${data.details}`;
              patchState({ hlsError: msg, loading: false });
              onError?.(msg);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = streamUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          patchState({ loading: false });
          if (initialTimeRef.current > 0) {
            video.currentTime = initialTimeRef.current;
          }
          video.play().catch(() => {});
        },
        { once: true }
      );
    } else {
      const msg = "HLS video playback is not supported on this browser.";
      patchState({ hlsError: msg, loading: false });
      onError?.(msg);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Video Events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => patchState({ playing: true });
    const onPause = () => patchState({ playing: false });
    const onWaiting = () => patchState({ loading: true });
    const onCanPlay = () => patchState({ loading: false });
    const onDuration = () => patchState({ duration: video.duration });
    const onVolume = () => patchState({ volume: video.volume, muted: video.muted });
    const onRateChange = () => patchState({ playbackRate: video.playbackRate });

    const onTime = () => {
      patchState({ currentTime: video.currentTime });
      onTimeUpdate?.(video.currentTime);
      if (video.buffered.length > 0) {
        patchState({ buffered: video.buffered.end(video.buffered.length - 1) });
      }
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("durationchange", onDuration);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ratechange", onRateChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("durationchange", onDuration);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ratechange", onRateChange);
    };
  }, [patchState, onTimeUpdate]);

  // ── Control Actions ────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [showControls]);

  const seekBy = useCallback(
    (seconds) => {
      const video = videoRef.current;
      if (!video) return;
      showControls();
      const end = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.min(end, Math.max(0, video.currentTime + seconds));
    },
    [showControls]
  );

  const refreshStream = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    if (hlsRef.current) {
      hlsRef.current.startLoad();
    }
    video.currentTime = 0;
    video.play().catch(() => {});
  }, [showControls]);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    video.muted = !video.muted;
  }, [showControls]);

  const setVolumeRatio = useCallback((ratio) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    video.volume = clamped;
    video.muted = clamped === 0;
  }, []);

  // Vertical volume slider drag math
  const handleVolumePointer = useCallback(
    (e) => {
      const slider = volumeSliderRef.current;
      if (!slider) return;
      const rect = slider.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const height = rect.height;
      const ratio = 1 - clickY / height;
      setVolumeRatio(ratio);
    },
    [setVolumeRatio]
  );

  const handleTimelineClick = useCallback(
    (e) => {
      const bar = progressBarRef.current;
      const video = videoRef.current;
      if (!bar || !video || !video.duration) return;
      showControls();
      const rect = bar.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      video.currentTime = ratio * video.duration;
    },
    [showControls]
  );

  const handleTimelineMouseMove = useCallback(
    (e) => {
      const bar = progressBarRef.current;
      const video = videoRef.current;
      if (!bar || !video || !video.duration) return;
      const rect = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setHoverPosition(pos * 100);
      setHoverTime(pos * video.duration);
    },
    []
  );

  const handleTimelineMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleFullscreen = useCallback(async () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    showControls();

    try {
      if (!document.fullscreenElement) {
        if (wrapper.requestFullscreen) {
          await wrapper.requestFullscreen();
        } else if (wrapper.webkitRequestFullscreen) {
          await wrapper.webkitRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e.message);
    }
  }, [showControls]);

  const handlePip = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    showControls();
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("PiP toggle error:", e.message);
    }
  }, [showControls]);

  const handleSpeedChange = useCallback((speed) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    patchState({ playbackRate: speed });
  }, [patchState]);

  const handleQualityChange = useCallback(
    (levelIndex) => {
      if (!hlsRef.current) return;
      hlsRef.current.currentLevel = levelIndex;
      patchState({ activeLevel: levelIndex });
    },
    [patchState]
  );

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  // Keyboard bindings
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      switch (e.key) {
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          showControls();
          setVolumeRatio(playerState.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          showControls();
          setVolumeRatio(playerState.volume - 0.1);
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "f":
        case "F":
          e.preventDefault();
          handleFullscreen();
          break;
        case "p":
        case "P":
          e.preventDefault();
          handlePip();
          break;
        case "Escape":
          if (showSettings) {
            setShowSettings(false);
          } else if (document.fullscreenElement) {
            handleFullscreen();
          } else {
            onClose?.();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    togglePlay,
    seekBy,
    setVolumeRatio,
    toggleMute,
    handleFullscreen,
    handlePip,
    playerState.volume,
    showControls,
    showSettings,
    onClose,
  ]);

  const {
    playing,
    muted,
    volume,
    currentTime,
    duration,
    buffered,
    loading,
    hlsError,
    levels,
    activeLevel,
    playbackRate,
  } = playerState;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const currentVolume = muted ? 0 : volume;

  return (
    <div
      ref={wrapperRef}
      className={`liquid-player-ctr vid-ctr ${isFullscreen ? "fs" : ""}`}
      onMouseMove={showControls}
      onMouseLeave={() => playing && !showSettings && setControlsVisible(false)}
      onTouchStart={showControls}
    >
      {/* ── SVG Filter for authentic Liquid Glass distortion ── */}
      <svg style={{ display: "none" }} aria-hidden="true">
        <filter id="glass-distortion" x="0%" y="0%" width="100%" height="100%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.01" numOctaves={1} seed={5} result="turbulence" />
          <feComponentTransfer in="turbulence" result="mapped">
            <feFuncR type="gamma" amplitude={1} exponent={10} offset={0.5} />
            <feFuncG type="gamma" amplitude={0} exponent={1} offset={0} />
            <feFuncB type="gamma" amplitude={0} exponent={1} offset={0.5} />
          </feComponentTransfer>
          <feGaussianBlur in="turbulence" stdDeviation={3} result="softMap" />
          <feSpecularLighting in="softMap" surfaceScale={5} specularConstant={1} specularExponent={100} lightingColor="white" result="specLight">
            <fePointLight x={-200} y={-200} z={300} />
          </feSpecularLighting>
          <feComposite in="specLight" operator="arithmetic" k1={0} k2={1} k3={1} k4={0} result="litImage" />
          <feDisplacementMap in="SourceGraphic" in2="softMap" scale={120} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>

      {/* ── Video Element ── */}
      <video
        ref={videoRef}
        className="vid"
        playsInline
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={handleFullscreen}
      >
        {subtitles.map((sub, i) => (
          <track
            key={sub.proxyUrl || i}
            kind="subtitles"
            src={sub.proxyUrl}
            srcLang={sub.lang || "en"}
            label={sub.label}
            default={activeSubtitle === i}
          />
        ))}
      </video>

      {/* ── Top Bar (Floating Liquid Glass Capsules) ── */}
      <div
        className="liquid-top-bar"
        style={{
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        {title && (
          <div className="liquidGlass-wrapper liquid-title-pill">
            <div className="liquidGlass-effect" />
            <div className="liquidGlass-shine" />
            <div className="liquidGlass-constant" />
            <div className="liquidGlass-text">
              <span className="truncate max-w-[220px] sm:max-w-md">{title}</span>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {onClose && (
          <button
            onClick={onClose}
            className="liquidGlass-wrapper liquid-close-btn"
            title="Close Player (Esc)"
            aria-label="Close Player"
          >
            <div className="liquidGlass-effect" />
            <div className="liquidGlass-shine" />
            <div className="liquidGlass-constant" />
            <div className="liquidGlass-text">
              <CloseIcon />
            </div>
          </button>
        )}
      </div>

      {/* ── Center Controls with Liquid Glass Architecture ── */}
      <div
        className="c-ctrls"
        style={{
          opacity: controlsVisible && !loading ? 1 : 0,
          pointerEvents: controlsVisible && !loading ? "auto" : "none",
        }}
      >
        {/* 10s Backward */}
        <button
          onClick={() => seekBy(-10)}
          className="liquidGlass-wrapper seek-b c-ctrl-btn"
          title="Back 10 seconds (←)"
          aria-label="Back 10 seconds"
        >
          <div className="liquidGlass-effect" />
          <div className="liquidGlass-shine" />
          <div className="liquidGlass-constant" />
          <div className="liquidGlass-text">
            <SeekBackIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>

        {/* Reload / Refresh stream */}
        <button
          onClick={refreshStream}
          className="liquidGlass-wrapper refresh c-ctrl-btn"
          title="Reload Stream"
          aria-label="Reload Stream"
        >
          <div className="liquidGlass-effect" />
          <div className="liquidGlass-shine" />
          <div className="liquidGlass-constant" />
          <div className="liquidGlass-text">
            <RefreshIcon className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
        </button>

        {/* Large Center Liquid Glass Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="liquidGlass-wrapper c-play c-ctrl-btn"
          title={playing ? "Pause (Space)" : "Play (Space)"}
          aria-label={playing ? "Pause" : "Play"}
        >
          <div className="liquidGlass-effect" />
          <div className="liquidGlass-shine" />
          <div className="liquidGlass-constant" />
          <div className="liquidGlass-text">
            {playing ? (
              <PauseIcon className="w-8 h-8 sm:w-11 sm:h-11" />
            ) : (
              <PlayIcon className="w-8 h-8 sm:w-11 sm:h-11 ml-1" />
            )}
          </div>
        </button>

        {/* 10s Forward */}
        <button
          onClick={() => seekBy(10)}
          className="liquidGlass-wrapper seek-f c-ctrl-btn"
          title="Forward 10 seconds (→)"
          aria-label="Forward 10 seconds"
        >
          <div className="liquidGlass-effect" />
          <div className="liquidGlass-shine" />
          <div className="liquidGlass-constant" />
          <div className="liquidGlass-text">
            <SeekForwardIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
        </button>
      </div>

      {/* ── Loading Spinner ── */}
      {loading && !hlsError && (
        <div className="loader" role="status" aria-label="Loading stream" />
      )}

      {/* ── Error Overlay ── */}
      {hlsError && (
        <div className="hls-error animate-fade-in z-20">
          <div className="text-red-400 text-3xl mb-2">⚠️</div>
          <p className="text-ivory font-semibold text-sm mb-1">Playback Encountered an Error</p>
          <p className="text-ivory-muted text-xs text-center max-w-xs px-4">{hlsError}</p>
          <button onClick={refreshStream} className="btn-gold mt-3 text-xs py-1.5 px-4">
            Retry Playback
          </button>
        </div>
      )}

      {/* ── Bottom Control Bar ── */}
      <div
        className="ctrl-ctr"
        style={{
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <div className="ctrls">
          {/* Progress Timeline Bar */}
          <div
            ref={progressBarRef}
            className="prog-bar relative group"
            onClick={handleTimelineClick}
            onMouseMove={handleTimelineMouseMove}
            onMouseLeave={handleTimelineMouseLeave}
          >
            {/* Buffered track */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20 rounded-full pointer-events-none"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played track */}
            <div
              className="prog rounded-full"
              style={{ width: `${progressPct}%` }}
            />

            {/* Hover Tooltip Preview */}
            {hoverTime !== null && (
              <div
                className="prev-tt"
                style={{
                  left: `${hoverPosition}%`,
                  opacity: 1,
                }}
              >
                {fmtTime(hoverTime)}
              </div>
            )}
          </div>

          {/* Button Row */}
          <div className="btn-ctr">
            {/* Left Controls */}
            <div className="l-ctrls">
              {/* Play / Pause Toggle */}
              <button
                onClick={togglePlay}
                className="ctrl-btn play-pause"
                title={playing ? "Pause" : "Play"}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <PauseIcon /> : <PlayIcon />}
              </button>

              {/* Volume Button & Vertical Liquid Glass Capsule Tray */}
              <div
                className="vol-ctr"
                onMouseEnter={() => setIsVolumeDragging(true)}
                onMouseLeave={() => setIsVolumeDragging(false)}
              >
                <button
                  onClick={toggleMute}
                  className="ctrl-btn volume"
                  title={muted ? "Unmute (M)" : "Mute (M)"}
                  aria-label={muted ? "Unmute" : "Mute"}
                >
                  {muted || currentVolume === 0 ? (
                    <VolumeMuteIcon />
                  ) : currentVolume < 0.5 ? (
                    <VolumeLowIcon />
                  ) : (
                    <VolumeHighIcon />
                  )}
                </button>

                {/* Vertical Capsule Slider */}
                <div
                  ref={volumeSliderRef}
                  className={`vol-sld ${isVolumeDragging ? "vol-sld-active" : ""}`}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    handleVolumePointer(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) handleVolumePointer(e);
                  }}
                  style={{
                    "--volume-level": `${currentVolume * 100}%`,
                  }}
                >
                  <div className="liquidGlass-effect" />
                  <div className="liquidGlass-shine" />
                  <div className="liquidGlass-constant" />
                  <div className="liquidGlass-text">
                    <div className="vol-sld-trk">
                      <div
                        className="vol-thm"
                        style={{
                          top: `${(1 - currentVolume) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Liquid Glass Time Display Capsule */}
              <div className="liquidGlass-wrapper time-display">
                <div className="liquidGlass-effect" />
                <div className="liquidGlass-shine" />
                <div className="liquidGlass-constant" />
                <div className="liquidGlass-text">
                  <div className="time font-mono">
                    <span className="current-time">{fmtTime(currentTime)}</span>
                    <span className="mx-1 text-white/50">/</span>
                    <span className="duration text-white/70">{fmtTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Controls (Grouped in Liquid Glass Pill) */}
            <div className="r-ctrls">
              <div className="liquidGlass-wrapper r-ctrls-btns">
                <div className="liquidGlass-effect" />
                <div className="liquidGlass-shine" />
                <div className="liquidGlass-constant" />
                <div className="liquidGlass-text flex items-center gap-1.5 px-2">
                  {/* Settings Button */}
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="ctrl-btn settings-btn"
                    title="Settings"
                    aria-label="Settings"
                  >
                    <SettingsIcon />
                  </button>

                  {/* Subtitle / CC Toggle */}
                  {subtitles.length > 0 && (
                    <button
                      onClick={() => {
                        const next = activeSubtitle === -1 ? 0 : -1;
                        setActiveSubtitle(next);
                      }}
                      className={`ctrl-btn font-mono text-[11px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                        activeSubtitle !== -1 ? "text-white bg-white/20" : "text-white/60 hover:text-white"
                      }`}
                      title={activeSubtitle !== -1 ? "Subtitles On" : "Subtitles Off"}
                    >
                      CC
                    </button>
                  )}

                  {/* Picture-in-Picture */}
                  <button
                    onClick={handlePip}
                    className="ctrl-btn pip-btn"
                    title="Picture in Picture (P)"
                    aria-label="Picture in Picture"
                  >
                    <PipIcon />
                  </button>

                  {/* Fullscreen Button */}
                  <button
                    onClick={handleFullscreen}
                    className="ctrl-btn fs-btn"
                    title={isFullscreen ? "Exit Fullscreen (F)" : "Fullscreen (F)"}
                    aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                  >
                    {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Liquid Glass Settings Flyout Panel ── */}
      <div
        ref={settingsPanelRef}
        className={`settings-panel ${showSettings ? "show" : ""}`}
      >
        <div className="settings-header">
          <span className="text-sm font-semibold tracking-wide">Playback Settings</span>
          <button
            onClick={() => setShowSettings(false)}
            className="close-settings flex items-center justify-center text-white/70 hover:text-white"
            aria-label="Close Settings"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="settings-content text-xs">
          {/* Quality Selector */}
          {levels.length > 0 && (
            <div className="setting-item">
              <span className="text-white/80">Quality</span>
              <div className="glass-select">
                <select
                  value={activeLevel}
                  onChange={(e) => handleQualityChange(parseInt(e.target.value))}
                  className="bg-black/60 text-white text-xs rounded-lg px-2.5 py-1 border border-white/20 outline-none cursor-pointer"
                >
                  <option value={-1}>Auto</option>
                  {levels.map((lvl) => (
                    <option key={lvl.index} value={lvl.index}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Speed Selector */}
          <div className="setting-item">
            <span className="text-white/80">Speed</span>
            <div className="glass-select">
              <select
                value={playbackRate}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="bg-black/60 text-white text-xs rounded-lg px-2.5 py-1 border border-white/20 outline-none cursor-pointer"
              >
                <option value={0.5}>0.5×</option>
                <option value={0.75}>0.75×</option>
                <option value={1}>Normal</option>
                <option value={1.25}>1.25×</option>
                <option value={1.5}>1.5×</option>
                <option value={2}>2×</option>
              </select>
            </div>
          </div>

          {/* Subtitles Selector */}
          {subtitles.length > 0 && (
            <div className="setting-item">
              <span className="text-white/80">Subtitles</span>
              <div className="glass-select">
                <select
                  value={activeSubtitle}
                  onChange={(e) => setActiveSubtitle(parseInt(e.target.value))}
                  className="bg-black/60 text-white text-xs rounded-lg px-2.5 py-1 border border-white/20 outline-none cursor-pointer max-w-[120px] truncate"
                >
                  <option value={-1}>Off</option>
                  {subtitles.map((sub, idx) => (
                    <option key={sub.proxyUrl || idx} value={idx}>
                      {sub.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
