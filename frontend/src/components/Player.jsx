/**
 * Player.jsx — Liquid Glass UI Video Player
 * Theme based on https://github.com/b4-behroz/Liquid-Glass-UI-Video-Player
 *
 * Props:
 *   streamUrl   {string}         — Proxied /proxy/hls?url=... URL
 *   subtitles   {Array}          — Subtitle tracks list [{label, proxyUrl, lang, default, content}]
 *   title       {string}         — Display title overlay
 *   initialTime {number}         — Resume playback position in seconds
 *   onTimeUpdate{(time) => void} — Time update callback
 *   onClose     {() => void}     — Callback to dismiss the player
 *   onError     {(msg) => void}  — Error callback
 */
import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

// ─── Liquid Glass Filter Definition ──────────────────────────────────────────
const GlassDistortionFilter = () => (
  <svg style={{ display: "none", position: "absolute", width: 0, height: 0 }}>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.01 0.01"
        numOctaves="1"
        seed="5"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="16"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

// ─── Liquid Glass Wrapper Component ──────────────────────────────────────────
function LiquidGlass({
  children,
  className = "",
  onClick,
  style = {},
  title,
  ...props
}) {
  return (
    <div
      className={`liquidGlass-wrapper ${className}`}
      onClick={onClick}
      style={style}
      title={title}
      {...props}
    >
      <div className="liquidGlass-effect" />
      <div className="liquidGlass-shine" />
      <div className="liquidGlass-constant" />
      <div className="liquidGlass-text">{children}</div>
    </div>
  );
}

// ─── Icons from Liquid Glass UI Video Player ─────────────────────────────────

const VolumeIcon = ({ muted, volume }) => {
  if (muted || volume === 0) {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-5 md:h-5 fill-white">
        <path d="M11.60 2.08L11.48 2.14L3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87C1.26 9.77 1.00 10.79 1 11.83V12.16L1.01 12.56C1.07 13.52 1.37 14.46 1.87 15.29C2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.80 21.99 11.98 21.99C12.16 22.00 12.33 21.95 12.49 21.87C12.64 21.78 12.77 21.65 12.86 21.50C12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52C12.80 2.37 12.68 2.25 12.54 2.16C12.41 2.07 12.25 2.01 12.08 2.00C11.92 1.98 11.75 2.01 11.60 2.08ZM4.94 8.4V8.40L11 4.76V19.23L4.94 15.6C4.38 15.26 3.92 14.80 3.58 14.25C3.24 13.70 3.05 13.07 3.00 12.43L3 12.17V11.83C2.99 11.14 3.17 10.46 3.51 9.86C3.85 9.25 4.34 8.75 4.94 8.4ZM21.29 8.29L19 10.58L16.70 8.29L16.63 8.22C16.43 8.07 16.19 7.99 15.95 8.00C15.70 8.01 15.47 8.12 15.29 8.29C15.12 8.47 15.01 8.70 15.00 8.95C14.99 9.19 15.07 9.43 15.22 9.63L15.29 9.70L17.58 12L15.29 14.29C15.19 14.38 15.12 14.49 15.06 14.61C15.01 14.73 14.98 14.87 14.98 15.00C14.98 15.13 15.01 15.26 15.06 15.39C15.11 15.51 15.18 15.62 15.28 15.71C15.37 15.81 15.48 15.88 15.60 15.93C15.73 15.98 15.86 16.01 15.99 16.01C16.12 16.01 16.26 15.98 16.38 15.93C16.50 15.87 16.61 15.80 16.70 15.70L19 13.41L21.29 15.70L21.36 15.77C21.56 15.93 21.80 16.01 22.05 15.99C22.29 15.98 22.53 15.88 22.70 15.70C22.88 15.53 22.98 15.29 22.99 15.05C23.00 14.80 22.93 14.56 22.77 14.36L22.70 14.29L20.41 12L22.70 9.70C22.80 9.61 22.87 9.50 22.93 9.38C22.98 9.26 23.01 9.12 23.01 8.99C23.01 8.86 22.98 8.73 22.93 8.60C22.88 8.48 22.81 8.37 22.71 8.28C22.62 8.18 22.51 8.11 22.39 8.06C22.26 8.01 22.13 7.98 22.00 7.98C21.87 7.98 21.73 8.01 21.61 8.06C21.49 8.12 21.38 8.19 21.29 8.29Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-5 md:h-5 fill-white">
      <path d="M11 4.76V19.23L4.94 15.6C4.38 15.26 3.92 14.80 3.58 14.25C3.24 13.70 3.05 13.07 3.00 12.43L3 12.17V11.83C2.99 11.14 3.17 10.46 3.51 9.86C3.85 9.25 4.34 8.75 4.94 8.4L11 4.76Z" />
      <path
        d="M15.54 8.46a5 5 0 0 1 0 7.07"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {volume >= 0.5 && (
        <path
          d="M18.36 5.64a9 9 0 0 1 0 12.72"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
};

const SettingsIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-5 md:h-5">
    <path
      d="M12.84 1H11.15C10.72 .99 10.30 1.14 9.95 1.40C9.60 1.66 9.35 2.02 9.23 2.44L9.19 2.61C9.11 3.00 8.96 3.38 8.73 3.71C8.51 4.04 8.22 4.33 7.89 4.55L7.75 4.64C7.37 4.85 6.96 4.98 6.53 5.02C6.11 5.06 5.68 5.01 5.27 4.87C4.86 4.73 4.42 4.73 4.00 4.86C3.59 5.00 3.23 5.26 2.99 5.62L2.89 5.77L2.05 7.23C1.82 7.63 1.73 8.10 1.81 8.55C1.88 9.01 2.12 9.43 2.47 9.73L2.58 9.84C3.15 10.39 3.50 11.15 3.50 12L3.49 12.16C3.47 12.56 3.37 12.95 3.19 13.31C3.01 13.67 2.77 13.99 2.47 14.26C2.12 14.56 1.88 14.98 1.81 15.43C1.73 15.89 1.82 16.36 2.05 16.76L2.89 18.22L2.99 18.37C3.24 18.73 3.59 18.99 4.01 19.13C4.42 19.26 4.86 19.26 5.27 19.12L5.42 19.07C5.81 18.96 6.21 18.93 6.61 18.98C7.01 19.03 7.40 19.15 7.75 19.36L7.89 19.44C8.22 19.66 8.51 19.95 8.73 20.28C8.96 20.61 9.11 20.99 9.19 21.38C9.28 21.84 9.52 22.24 9.88 22.54C10.24 22.83 10.69 23.00 11.15 23H12.84C13.30 23.00 13.75 22.83 14.11 22.54C14.47 22.24 14.71 21.84 14.80 21.38C14.89 20.96 15.06 20.56 15.31 20.21C15.55 19.86 15.88 19.57 16.25 19.36L16.39 19.28C16.75 19.10 17.14 18.99 17.54 18.96C17.94 18.94 18.34 18.99 18.72 19.12L18.89 19.17C19.31 19.27 19.75 19.24 20.15 19.07C20.55 18.90 20.88 18.60 21.10 18.23L21.95 16.76C22.18 16.36 22.26 15.89 22.19 15.43C22.11 14.98 21.88 14.56 21.53 14.26C21.23 13.99 20.98 13.67 20.80 13.31C20.63 12.95 20.52 12.56 20.50 12.16L20.50 12C20.50 11.57 20.59 11.14 20.77 10.75C20.94 10.36 21.20 10.01 21.53 9.73C21.88 9.43 22.11 9.01 22.19 8.55C22.26 8.10 22.18 7.63 21.95 7.23L21.10 5.76C20.88 5.39 20.55 5.09 20.15 4.92C19.76 4.75 19.31 4.72 18.89 4.82L18.72 4.87C18.34 5.00 17.94 5.05 17.54 5.03C17.14 5.00 16.75 4.89 16.4 4.71L16.25 4.63C15.88 4.42 15.56 4.13 15.31 3.78C15.06 3.43 14.89 3.03 14.80 2.61C14.71 2.15 14.47 1.74 14.11 1.45C13.75 1.16 13.30 .99 12.84 1ZM11.15 3H12.84C12.98 3.70 13.26 4.36 13.68 4.94C14.09 5.52 14.63 6.01 15.25 6.37C15.87 6.72 16.55 6.94 17.26 7.01C17.97 7.08 18.69 6.99 19.37 6.76L20.21 8.23C19.67 8.69 19.24 9.27 18.94 9.92C18.65 10.57 18.50 11.28 18.5 12C18.50 12.71 18.65 13.42 18.95 14.07C19.24 14.72 19.67 15.29 20.21 15.76L19.37 17.23C18.69 16.99 17.97 16.91 17.26 16.98C16.55 17.05 15.86 17.27 15.25 17.63C14.63 17.98 14.09 18.47 13.68 19.05C13.26 19.63 12.98 20.29 12.84 21H11.15C11.01 20.29 10.73 19.63 10.31 19.05C9.90 18.47 9.36 17.98 8.75 17.62C8.13 17.27 7.44 17.05 6.73 16.98C6.02 16.91 5.30 16.99 4.62 17.23L3.78 15.76C4.32 15.29 4.75 14.71 5.05 14.06C5.34 13.41 5.49 12.71 5.5 12C5.50 11.28 5.34 10.57 5.05 9.92C4.75 9.27 4.32 8.69 3.78 8.23L4.62 6.76C5.30 7.00 6.02 7.08 6.73 7.01C7.44 6.94 8.13 6.72 8.75 6.37C9.36 6.01 9.90 5.52 10.31 4.94C10.73 4.36 11.01 3.70 11.15 3ZM12.00 8C10.94 8 9.92 8.42 9.17 9.17C8.42 9.92 8.00 10.93 8.00 12C8.00 13.06 8.42 14.07 9.17 14.82C9.92 15.57 10.94 16 12.00 16C13.06 16 14.08 15.57 14.83 14.82C15.58 14.07 16.00 13.06 16.00 12C16.00 10.93 15.58 9.92 14.83 9.17C14.08 8.42 13.06 8 12.00 8ZM12.00 10H12L12.20 10.01C12.69 10.06 13.15 10.29 13.48 10.65C13.81 11.02 14.00 11.50 14 12L13.99 12.20C13.95 12.58 13.80 12.95 13.55 13.25C13.31 13.55 12.98 13.78 12.62 13.90C12.25 14.02 11.85 14.03 11.48 13.93C11.11 13.83 10.77 13.62 10.51 13.34C10.25 13.05 10.08 12.69 10.02 12.31C9.96 11.93 10.01 11.54 10.17 11.18C10.32 10.83 10.58 10.53 10.91 10.32C11.23 10.11 11.61 10.00 12 10"
      fill="white"
    />
  </svg>
);

const FullscreenIcon = () => (
  <svg fill="white" viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-5 md:h-5">
    <path d="M21 3a2 2 0 0 1 2 2v14a2 2 0 0 1-1.79 1.99L21 21H3l-.20-.01a2 2 0 0 1-1.78-1.78L1 19V5a2 2 0 0 1 2-2h18ZM3 19h18V5H3v14Zm15-8a1 1 0 0 1 1 1v5h-5a1 1 0 1 1 0-2h3v-3a1 1 0 0 1 1-1Zm-8-4a1 1 0 1 1 0 2H7v3a1 1 0 1 1-2 0V7h5Z" />
  </svg>
);

const ExitFullscreenIcon = () => (
  <svg fill="white" viewBox="0 0 24 24" className="w-3.5 h-3.5 md:w-5 md:h-5">
    <path d="M3 19h11v2H3l-.20-.01a2 2 0 0 1-1.78-1.78L1 19v-7h2v7Zm19.00-5a1 1 0 1 1 0 2h-4v4a1 1 0 1 1-2 0v-6h6ZM21 3a2 2 0 0 1 2 2v7h-2V5H10V3h11ZM7.00 3a1 1 0 0 1 1 1v6h-6a1 1 0 0 1 0-2h4V4a1 1 0 0 1 1-1Z" />
  </svg>
);

const PiPIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5 md:w-5 md:h-5"
  >
    <path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4" />
    <rect width="10" height="7" x="12" y="13" rx="2" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-3.5 h-3.5 md:w-5 md:h-5 text-white"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const SUBTITLE_SIZES = [
  { label: "Small (75%)", value: "small", cssSize: "0.85rem" },
  { label: "Normal (100%)", value: "normal", cssSize: "1.15rem" },
  { label: "Large (125%)", value: "large", cssSize: "1.45rem" },
  { label: "Huge (150%)", value: "huge", cssSize: "1.85rem" },
];

const SUBTITLE_STYLES = [
  {
    label: "Classic White",
    value: "classic",
    color: "#ffffff",
    bg: "rgba(10, 11, 12, 0.85)",
    shadow: "0 2px 4px rgba(0, 0, 0, 0.9)",
  },
  {
    label: "Anime Yellow",
    value: "yellow",
    color: "#fde047",
    bg: "rgba(10, 11, 12, 0.85)",
    shadow: "0 2px 4px rgba(0, 0, 0, 0.9)",
  },
  {
    label: "Text Outline",
    value: "outline",
    color: "#ffffff",
    bg: "transparent",
    shadow:
      "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 3px 6px rgba(0,0,0,0.9)",
  },
  {
    label: "Cyan Accent",
    value: "cyan",
    color: "#67e8f9",
    bg: "rgba(10, 11, 12, 0.85)",
    shadow: "0 2px 4px rgba(0, 0, 0, 0.9)",
  },
  {
    label: "High Contrast",
    value: "contrast",
    color: "#ffffff",
    bg: "#000000",
    shadow: "none",
  },
];

const SUBTITLE_POSITIONS = [
  { label: "Bottom (Default)", value: "bottom", linePercent: 92 },
  { label: "Raised", value: "raised", linePercent: 76 },
  { label: "Top", value: "top", linePercent: 10 },
];

const WarningIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-10 h-10 text-red-400"
    aria-hidden="true"
  >
    <path d="m10.3 3.8-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9v4m0 4h.01" />
  </svg>
);

// ─── Custom Glass Select Component ───────────────────────────────────────────
function GlassSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(true);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, []);

  const handleToggle = () => {
    if (!open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUpward(spaceBelow < 180 && rect.top > 180);
    }
    setOpen((prev) => !prev);
  };

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div className={`glass-select ${open ? "open" : ""}`} ref={containerRef}>
      <div
        className="glass-select-trigger"
        onClick={handleToggle}
      >
        <span className="glass-select-value truncate mr-1.5">
          {selectedOption?.label}
        </span>
        <svg className="glass-select-arrow" viewBox="0 0 10 6">
          <path d="M0 0l5 6 5-6z" fill="white" />
        </svg>
      </div>
      {open && (
        <div className={`glass-select-options ${openUpward ? "open-up" : "open-down"}`}>
          {options.map((opt) => (
            <div
              key={String(opt.value)}
              className={`glass-select-option ${
                opt.value === value ? "selected" : ""
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.value === value && <span className="font-bold ml-2">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formatting helpers ───────────────────────────────────────────────────────
function fmtTime(secs) {
  if (!isFinite(secs) || isNaN(secs)) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function Player({
  streamUrl,
  rawStreamUrl,
  downloadUrl,
  streams = [],
  availableServers = { sub: [], dub: [] },
  currentType = "sub",
  subtitles = [],
  title,
  initialTime = 0,
  onTimeUpdate,
  onClose,
  onDownload,
  onError,
}) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const wrapperRef = useRef(null);
  const progressRef = useRef(null);
  const volumeSliderRef = useRef(null);
  const volumeCtrRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const controlsTimerRef = useRef(null);
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
    hasEnded: false,
    playbackRate: 1,
    hlsError: null,
    levels: [],
    activeLevel: -1,
  });

  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [hoverPos, setHoverPos] = useState(null); // { pct, time }
  const [activeSubtitle, setActiveSubtitle] = useState(-1);
  const [subtitleSources, setSubtitleSources] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadToast, setDownloadToast] = useState(false);
  const [downloadModalOpen, setDownloadModalOpen] = useState(false);
  const [downloadAudioType, setDownloadAudioType] = useState(currentType || "sub");

  useEffect(() => {
    if (currentType) setDownloadAudioType(currentType);
  }, [currentType]);

  // Subtitle custom style & size states (persisted in localStorage)
  const [subtitleSize, setSubtitleSize] = useState(() => {
    try {
      return localStorage.getItem("animex_sub_size") || "normal";
    } catch (_) {
      return "normal";
    }
  });

  const [subtitleStyle, setSubtitleStyle] = useState(() => {
    try {
      return localStorage.getItem("animex_sub_style") || "classic";
    } catch (_) {
      return "classic";
    }
  });

  const [subtitlePosition, setSubtitlePosition] = useState(() => {
    try {
      return localStorage.getItem("animex_sub_position") || "bottom";
    } catch (_) {
      return "bottom";
    }
  });

  const handleSubtitleSizeChange = useCallback((newSize) => {
    setSubtitleSize(newSize);
    try {
      localStorage.setItem("animex_sub_size", newSize);
    } catch (_) {}
  }, []);

  const handleSubtitleStyleChange = useCallback((newStyle) => {
    setSubtitleStyle(newStyle);
    try {
      localStorage.setItem("animex_sub_style", newStyle);
    } catch (_) {}
  }, []);

  const handleSubtitlePositionChange = useCallback((newPos) => {
    setSubtitlePosition(newPos);
    try {
      localStorage.setItem("animex_sub_position", newPos);
    } catch (_) {}
  }, []);

  // Update dynamic CSS rules for ::cue
  useEffect(() => {
    const sizeObj =
      SUBTITLE_SIZES.find((s) => s.value === subtitleSize) ||
      SUBTITLE_SIZES[1];
    const styleObj =
      SUBTITLE_STYLES.find((s) => s.value === subtitleStyle) ||
      SUBTITLE_STYLES[0];

    let styleTag = document.getElementById("animex-sub-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "animex-sub-styles";
      document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      video::cue {
        font-size: ${sizeObj.cssSize} !important;
        color: ${styleObj.color} !important;
        background-color: ${styleObj.bg} !important;
        text-shadow: ${styleObj.shadow} !important;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
        line-height: 1.4 !important;
        border-radius: 6px !important;
        padding: 3px 8px !important;
      }
    `;
  }, [subtitleSize, subtitleStyle]);

  // Synchronize subtitle position on TextTrack VTTCues
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const applyPositionToCues = () => {
      const tracks = video.textTracks;
      if (!tracks || tracks.length === 0) return;
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        if (track.cues && track.cues.length > 0) {
          for (let j = 0; j < track.cues.length; j++) {
            const cue = track.cues[j];
            cue.snapToLines = false;
            if (subtitlePosition === "top") {
              cue.line = 10;
              cue.lineAlign = "start";
            } else if (subtitlePosition === "raised") {
              cue.line = 76;
              cue.lineAlign = "end";
            } else {
              cue.line = 92;
              cue.lineAlign = "end";
            }
          }
        }
      }
    };

    applyPositionToCues();

    const tracks = video.textTracks;
    const cleanups = [];
    if (tracks) {
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        const onCueChange = () => applyPositionToCues();
        tr.addEventListener("cuechange", onCueChange);
        cleanups.push(() => tr.removeEventListener("cuechange", onCueChange));
      }
    }

    return () => {
      cleanups.forEach((c) => c());
    };
  }, [subtitlePosition, activeSubtitle, subtitleSources]);

  // Trigger file download using extracted stream proxyUrl
  const triggerDownload = useCallback(
    (targetProxyUrl, qualityName = "") => {
      if (onDownload) {
        onDownload(targetProxyUrl, qualityName);
        setDownloadModalOpen(false);
        return;
      }

      let finalDownloadUrl =
        targetProxyUrl || streamUrl || downloadUrl || rawStreamUrl || "";
      if (!finalDownloadUrl) return;

      if (!finalDownloadUrl.startsWith("http")) {
        finalDownloadUrl = new URL(finalDownloadUrl, window.location.href).href;
      }

      try {
        navigator.clipboard?.writeText(finalDownloadUrl);
      } catch (_) {}

      const safeTitle = (title || "anime-episode")
        .replace(/[/\\?%*:|"<>]/g, "-")
        .trim();
      const isMp4 = finalDownloadUrl.toLowerCase().includes(".mp4");
      const cleanQuality = qualityName
        ? `-${qualityName.replace(/[/\\?%*:|"<>]/g, "_")}`
        : "";
      const filename = `${safeTitle}${cleanQuality}.${isMp4 ? "mp4" : "m3u8"}`;

      const link = document.createElement("a");
      link.href = finalDownloadUrl;
      link.download = filename;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setDownloadToast(
        `Starting download: ${qualityName || "Stream"} · Link copied`
      );
      setTimeout(() => setDownloadToast(false), 3500);
      setDownloadModalOpen(false);
    },
    [downloadUrl, rawStreamUrl, streamUrl, title, onDownload]
  );

  // Open download quality selection modal
  const handleOpenDownloadModal = useCallback(() => {
    const hasServers =
      (availableServers.sub && availableServers.sub.length > 0) ||
      (availableServers.dub && availableServers.dub.length > 0) ||
      (streams && streams.length > 0);

    if (hasServers) {
      if (currentType === "dub" && availableServers.dub?.length > 0) {
        setDownloadAudioType("dub");
      } else if (availableServers.sub?.length > 0) {
        setDownloadAudioType("sub");
      } else if (availableServers.dub?.length > 0) {
        setDownloadAudioType("dub");
      }
      setDownloadModalOpen(true);
    } else {
      triggerDownload(streamUrl, "Default");
    }
  }, [availableServers, streams, currentType, streamUrl, triggerDownload]);

  const patchState = useCallback((patch) => {
    setPlayerState((prev) => ({ ...prev, ...patch }));
  }, []);

  // ── Subtitle sources management ──────────────────────────────────────────
  useEffect(() => {
    const sources = subtitles.map((sub) => {
      if (typeof sub.content === "string" && sub.content.length > 0) {
        return URL.createObjectURL(
          new Blob([sub.content], { type: "text/vtt;charset=utf-8" })
        );
      }
      return sub.proxyUrl || "";
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

  // ── HLS Setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    const video = videoRef.current;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    patchState({ loading: true, hlsError: null, playing: false, hasEnded: false });

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
      const msg = "HLS is not supported in this browser.";
      patchState({ hlsError: msg, loading: false });
      onError?.(msg);
    }

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl, patchState, onError]);

  // ── Video Events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlers = {
      play: () => patchState({ playing: true, hasEnded: false }),
      pause: () => patchState({ playing: false }),
      waiting: () => patchState({ loading: true }),
      canplay: () => patchState({ loading: false }),
      ended: () => patchState({ playing: false, hasEnded: true }),
      durationchange: () => patchState({ duration: video.duration }),
      volumechange: () =>
        patchState({ volume: video.volume, muted: video.muted }),
      ratechange: () => patchState({ playbackRate: video.playbackRate }),
      timeupdate: () => {
        if (!seeking) {
          patchState({ currentTime: video.currentTime });
          onTimeUpdate?.(video.currentTime);
        }
        if (video.buffered.length > 0) {
          patchState({ buffered: video.buffered.end(video.buffered.length - 1) });
        }
      },
    };

    Object.entries(handlers).forEach(([ev, fn]) => video.addEventListener(ev, fn));
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) =>
        video.removeEventListener(ev, fn)
      );
    };
  }, [seeking, patchState, onTimeUpdate]);

  // ── Auto-hide Controls ───────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playerState.playing && !settingsOpen && !isDraggingVolume) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [playerState.playing, settingsOpen, isDraggingVolume]);

  useEffect(() => () => clearTimeout(controlsTimerRef.current), []);

  // ── Controls Actions ─────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    showControls();
  }, [showControls]);

  const handleReplay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {});
    patchState({ hasEnded: false });
    showControls();
  }, [patchState, showControls]);

  const skipBy = useCallback(
    (seconds) => {
      const video = videoRef.current;
      if (!video) return;
      const end = Number.isFinite(video.duration) ? video.duration : Infinity;
      video.currentTime = Math.min(end, Math.max(0, video.currentTime + seconds));
      showControls();
    },
    [showControls]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    showControls();
  }, [showControls]);

  // Vertical Volume Slider Dragging Math
  const updateVolumeFromY = useCallback(
    (clientY) => {
      const slider = volumeSliderRef.current;
      const video = videoRef.current;
      if (!slider || !video) return;
      const rect = slider.getBoundingClientRect();
      const relativeY = clientY - rect.top;
      const clampedY = Math.max(0, Math.min(rect.height, relativeY));
      const newVol = Math.max(0, Math.min(1, 1 - clampedY / rect.height));

      video.volume = newVol;
      video.muted = newVol === 0;
      patchState({ volume: newVol, muted: newVol === 0 });
    },
    [patchState]
  );

  const handleVolumePointerDown = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingVolume(true);
      e.currentTarget.setPointerCapture?.(e.pointerId);
      updateVolumeFromY(e.clientY);
    },
    [updateVolumeFromY]
  );

  const handleVolumePointerMove = useCallback(
    (e) => {
      if (!isDraggingVolume) return;
      e.preventDefault();
      updateVolumeFromY(e.clientY);
    },
    [isDraggingVolume, updateVolumeFromY]
  );

  const handleVolumePointerUp = useCallback(
    (e) => {
      if (isDraggingVolume) {
        setIsDraggingVolume(false);
        try {
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        } catch (_) {}
      }
    },
    [isDraggingVolume]
  );

  // Progress Bar Scrubbing
  const seekToPosition = useCallback(
    (clientX) => {
      const bar = progressRef.current;
      const video = videoRef.current;
      if (!bar || !video || !Number.isFinite(video.duration)) return;
      const rect = bar.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      video.currentTime = pos * video.duration;
      patchState({ currentTime: pos * video.duration });
    },
    [patchState]
  );

  const handleProgressClick = useCallback(
    (e) => {
      seekToPosition(e.clientX);
      showControls();
    },
    [seekToPosition, showControls]
  );

  const handleProgressMouseMove = useCallback((e) => {
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video || !Number.isFinite(video.duration)) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPos({ pct: pos, time: pos * video.duration });
  }, []);

  const handleProgressMouseLeave = useCallback(() => {
    setHoverPos(null);
  }, []);

  const handleProgressMouseDown = useCallback(
    (e) => {
      setSeeking(true);
      seekToPosition(e.clientX);

      const onMouseMove = (moveEvent) => {
        seekToPosition(moveEvent.clientX);
      };
      const onMouseUp = () => {
        setSeeking(false);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [seekToPosition]
  );

  const handleProgressTouch = useCallback(
    (e) => {
      if (e.touches && e.touches[0]) {
        seekToPosition(e.touches[0].clientX);
      }
    },
    [seekToPosition]
  );

  // Fullscreen
  useEffect(() => {
    const video = videoRef.current;
    const syncFullscreenState = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
            document.webkitFullscreenElement ||
            video?.webkitDisplayingFullscreen
        )
      );
    };

    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    video?.addEventListener("webkitbeginfullscreen", syncFullscreenState);
    video?.addEventListener("webkitendfullscreen", syncFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
      video?.removeEventListener("webkitbeginfullscreen", syncFullscreenState);
      video?.removeEventListener("webkitendfullscreen", syncFullscreenState);
    };
  }, []);

  const handleFullscreen = useCallback(async () => {
    const wrapper = wrapperRef.current;
    const video = videoRef.current;
    if (!wrapper || !video) return;

    showControls();

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    } else {
      if (wrapper.requestFullscreen) {
        await wrapper.requestFullscreen().catch(() => {});
      } else if (wrapper.webkitRequestFullscreen) {
        wrapper.webkitRequestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    }
  }, [showControls]);

  // Picture-in-Picture
  const handlePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  }, []);

  // Settings: Quality & Speed
  const handleQualityChange = useCallback(
    (levelIndex) => {
      if (hlsRef.current) {
        hlsRef.current.currentLevel = levelIndex;
      }
      patchState({ activeLevel: levelIndex });
    },
    [patchState]
  );

  const handleSpeedChange = useCallback(
    (speed) => {
      const video = videoRef.current;
      if (video) {
        video.playbackRate = speed;
      }
      patchState({ playbackRate: speed });
    },
    [patchState]
  );

  // Close settings panel when clicking outside
  useEffect(() => {
    if (!settingsOpen) return;
    const handleOutsideClick = (e) => {
      if (
        settingsPanelRef.current &&
        !settingsPanelRef.current.contains(e.target) &&
        !e.target.closest(".settings-btn")
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [settingsOpen]);

  // Keyboard Shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      switch (e.key.toLowerCase()) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          handleFullscreen();
          break;
        case "p":
          handlePiP();
          break;
        case "arrowright":
          skipBy(10);
          break;
        case "arrowleft":
          skipBy(-10);
          break;
        case "arrowup":
          if (videoRef.current) {
            const nextVol = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = nextVol;
            videoRef.current.muted = false;
            patchState({ volume: nextVol, muted: false });
          }
          break;
        case "arrowdown":
          if (videoRef.current) {
            const nextVol = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = nextVol;
            videoRef.current.muted = nextVol === 0;
            patchState({ volume: nextVol, muted: nextVol === 0 });
          }
          break;
        case "escape":
          if (isFullscreen) {
            handleFullscreen();
          } else if (downloadModalOpen) {
            setDownloadModalOpen(false);
          } else if (settingsOpen) {
            setSettingsOpen(false);
          } else {
            onClose?.();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    toggleMute,
    handleFullscreen,
    handlePiP,
    skipBy,
    isFullscreen,
    settingsOpen,
    onClose,
    patchState,
  ]);

  const {
    duration,
    currentTime,
    buffered,
    playing,
    muted,
    volume,
    loading,
    hasEnded,
    playbackRate,
    hlsError,
    levels,
    activeLevel,
  } = playerState;

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={wrapperRef}
      className={`player-wrapper animate-fade-in ${
        isFullscreen ? "is-fullscreen fs" : ""
      } ${controlsVisible ? "show-controls" : ""} sub-size-${subtitleSize} sub-style-${subtitleStyle} sub-pos-${subtitlePosition}`}
      onMouseMove={showControls}
      onMouseLeave={() => playing && !settingsOpen && setControlsVisible(false)}
      onTouchStart={showControls}
      style={{
        cursor: isFullscreen && !controlsVisible ? "none" : "default",
      }}
    >
      {/* SVG Distortion Matrix Filter */}
      <GlassDistortionFilter />

      {/* Top Title Bar */}
      <div
        className={`player-title-bar ${
          controlsVisible || !playing ? "is-visible" : ""
        }`}
        style={{
          opacity: controlsVisible || !playing ? 1 : 0,
        }}
      >
        <span className="text-white font-semibold text-sm line-clamp-1 max-w-[80%] drop-shadow-md">
          {title}
        </span>
        <LiquidGlass
          className="download-player-btn"
          onClick={handleOpenDownloadModal}
          title="Download Episode"
        >
          <DownloadIcon />
        </LiquidGlass>
      </div>

      {/* Download notification toast */}
      {downloadToast && (
        <div className="absolute top-14 right-4 z-40 animate-slide-up flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/85 border border-white/20 text-white text-xs backdrop-blur-2xl shadow-2xl">
          <DownloadIcon />
          <span>
            {typeof downloadToast === "string"
              ? downloadToast
              : "Starting download · Stream link copied"}
          </span>
        </div>
      )}

      {/* Video Canvas Stage */}
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
            />
          ))}
        </video>

        {/* Center Loader */}
        {loading && !hlsError && <div className="loader" />}

        {/* Error Overlay */}
        {hlsError && (
          <div className="hls-error animate-fade-in">
            <div className="mb-3">
              <WarningIcon />
            </div>
            <p className="text-white font-semibold mb-1">Stream Error</p>
            <p className="text-white/70 text-sm text-center max-w-xs mb-3">
              {hlsError}
            </p>
            <LiquidGlass
              className="px-4 py-2 text-xs text-white"
              onClick={() => {
                patchState({ hlsError: null, loading: true });
              }}
            >
              Retry
            </LiquidGlass>
          </div>
        )}
      </div>

      {/* Center Controls (Liquid Glass Capsules) */}
      <div
        className="c-ctrls"
        style={{
          opacity: (controlsVisible || !playing) && !loading ? 1 : 0,
          pointerEvents:
            (controlsVisible || !playing) && !loading ? "auto" : "none",
        }}
      >
        {/* Rewind 10s */}
        <LiquidGlass
          className="seek-b"
          onClick={() => skipBy(-10)}
          title="Rewind 10s"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 56 56"
            className="w-4 h-4 md:w-7 md:h-7"
          >
            <path
              d="M28 54.402c13.055 0 23.906-10.828 23.906-23.906c0-11.531-8.437-21.305-19.383-23.46v-3.33c0-1.664-1.148-2.11-2.437-1.195l-7.477 5.226c-1.054.75-1.078 1.875 0 2.649l7.453 5.25c1.313.937 2.461.492 2.461-1.196v-3.35c8.86 2.015 15.375 9.914 15.375 19.406A19.84 19.84 0 0 1 28 50.418c-11.063 0-19.945-8.86-19.922-19.922c.023-6.656 3.258-12.539 8.25-16.101c.961-.727 1.266-1.829.656-2.813c-.562-.96-1.851-1.219-2.883-.422C8.055 15.543 4.094 22.621 4.094 30.496c0 13.078 10.828 23.906 23.906 23.906m5.648-14.039c3.891 0 6.446-3.68 6.446-9.304c0-5.672-2.555-9.399-6.446-9.399s-6.445 3.727-6.445 9.399c0 5.625 2.555 9.304 6.445 9.304m-12.21-.281c.913 0 1.5-.633 1.5-1.617V23.723c0-1.149-.61-1.875-1.665-1.875c-.633 0-1.078.21-1.922.773l-3.257 2.18c-.516.375-.774.797-.774 1.36c0 .773.61 1.429 1.36 1.429c.445 0 .656-.094 1.125-.422l2.18-1.594v12.89c0 .962.585 1.618 1.452 1.618m12.21-2.555c-2.062 0-3.398-2.46-3.398-6.468c0-4.079 1.312-6.563 3.398-6.563c2.11 0 3.375 2.461 3.375 6.563c0 4.007-1.289 6.468-3.375 6.468"
              fill="white"
            />
          </svg>
        </LiquidGlass>

        {/* Center Play / Pause or Replay */}
        {hasEnded ? (
          <LiquidGlass
            className="refresh"
            onClick={handleReplay}
            title="Replay video"
          >
            <svg className="svg-icon w-5 h-5 md:w-8 md:h-8" viewBox="0 0 240 240">
              <path
                d="M120,41.9v-20c0-5-4-8-8-4l-44,28a5.865,5.865,0,0,0-3.3,7.6A5.943,5.943,0,0,0,68,56.8l43,29c5,4,9,1,9-4v-20a60,60,0,1,1-60,60H40a80,80,0,1,0,80-79.9Z"
                fill="white"
              />
            </svg>
          </LiquidGlass>
        ) : (
          <LiquidGlass
            className="c-play"
            onClick={togglePlay}
            title={playing ? "Pause (Space)" : "Play (Space)"}
          >
            {playing ? (
              <svg fill="none" viewBox="0 0 36 36" className="w-5 h-5 md:w-8 md:h-8">
                <path
                  d="M 12.75 4.5 L 9.75 4.5 C 9.15 4.5 8.58 4.73 8.15 5.15 C 7.73 5.58 7.5 6.15 7.5 6.75 L 7.5 29.25 C 7.5 29.84 7.73 30.41 8.15 30.84 C 8.58 31.26 9.15 31.5 9.75 31.5 L 12.75 31.5 C 13.34 31.5 13.91 31.26 14.34 30.84 C 14.76 30.41 15 29.84 15 29.25 L 15 6.75 C 15 6.15 14.76 5.58 14.34 5.15 C 13.91 4.73 13.34 4.5 12.75 4.5 Z M 26.25 4.5 L 23.25 4.5 C 22.65 4.5 22.08 4.73 21.65 5.15 C 21.23 5.58 21 6.15 21 6.75 V 29.25 C 21 29.84 21.23 30.41 21.65 30.84 C 22.08 31.26 22.65 31.5 23.25 31.5 L 26.25 31.5 C 26.84 31.5 27.41 31.26 27.84 30.84 C 28.26 30.41 28.5 29.84 28.5 29.25 V 6.75 L 28.5 6.75 C 28.5 6.15 28.26 5.58 27.84 5.15 C 27.41 4.73 26.84 4.5 26.25 4.5 Z"
                  fill="white"
                />
              </svg>
            ) : (
              <svg fill="none" viewBox="0 0 36 36" className="w-5 h-5 md:w-8 md:h-8">
                <path
                  d="M 17 8.6 L 10.89 4.99 C 9.39 4.11 7.5 5.19 7.5 6.93 L 7.5 29.06 C 7.5 30.8 9.39 31.88 10.89 31 L 17 27.4 L 17 8.6 Z M 17 8.6 V 27.4 L 33 18 L 17 8.6 Z"
                  fill="white"
                />
              </svg>
            )}
          </LiquidGlass>
        )}

        {/* Forward 10s */}
        <LiquidGlass
          className="seek-f"
          onClick={() => skipBy(10)}
          title="Forward 10s"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 56 56"
            className="w-4 h-4 md:w-7 md:h-7"
          >
            <path
              d="M28 54.402c13.055 0 23.906-10.828 23.906-23.906c0-7.875-3.984-14.953-10.008-19.336c-1.03-.797-2.32-.539-2.906.422c-.586.984-.281 2.086.656 2.813c4.993 3.562 8.25 9.445 8.274 16.101C47.945 41.56 39.039 50.418 28 50.418c-11.063 0-19.899-8.86-19.899-19.922c0-9.492 6.516-17.39 15.376-19.406v3.375c0 1.664 1.148 2.11 2.413 1.195l7.5-5.25c1.055-.726 1.079-1.851 0-2.625l-7.476-5.25c-1.29-.937-2.437-.492-2.437 1.196v3.304C12.507 9.168 4.094 18.965 4.094 30.496c0 13.078 10.828 23.906 23.906 23.906m5.672-14.039c3.89 0 6.422-3.68 6.422-9.304c0-5.672-2.532-9.399-6.422-9.399s-6.445 3.727-6.445 9.399c0 5.625 2.554 9.304 6.445 9.304m-12.235-.281c.914 0 1.524-.633 1.524-1.617V23.723c0-1.149-.633-1.875-1.688-1.875c-.633 0-1.054.21-1.922.773l-3.234 2.18c-.539.375-.773.797-.773 1.36c0 .773.609 1.429 1.359 1.429c.422 0 .656-.094 1.125-.422l2.18-1.594v12.89c0 .962.562 1.618 1.43 1.618m12.235-2.555c-2.086 0-3.399-2.46-3.399-6.468c0-4.079 1.29-6.563 3.399-6.563c2.086 0 3.351 2.461 3.351 6.563c0 4.007-1.289 6.468-3.351 6.468"
              fill="white"
            />
          </svg>
        </LiquidGlass>
      </div>

      {/* Settings Backdrop on Mobile */}
      {settingsOpen && (
        <div
          className="settings-backdrop md:hidden"
          onClick={() => setSettingsOpen(false)}
        />
      )}

      {/* Settings Flyout Panel / Mobile Bottom Sheet */}
      <div
        className={`settings-panel ${settingsOpen ? "show" : ""}`}
        ref={settingsPanelRef}
      >
        {/* Mobile Pull Handle Indicator */}
        <div className="sheet-handle-bar md:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-white/30" />
        </div>

        <div className="settings-header">
          <div className="flex items-center gap-2">
            <SettingsIcon />
            <span className="font-semibold text-white tracking-wide">Settings</span>
          </div>
          <div
            className="close-settings"
            onClick={() => setSettingsOpen(false)}
            title="Close Settings"
          >
            ✕
          </div>
        </div>
        <div className="settings-content">
          {/* Playback Speed */}
          <div className="setting-item">
            <span>Playback Speed</span>
            <GlassSelect
              value={playbackRate}
              options={[
                { label: "0.5×", value: 0.5 },
                { label: "0.75×", value: 0.75 },
                { label: "Normal", value: 1 },
                { label: "1.25×", value: 1.25 },
                { label: "1.5×", value: 1.5 },
                { label: "2×", value: 2 },
              ]}
              onChange={handleSpeedChange}
            />
          </div>

          {/* Quality Levels */}
          {levels.length > 0 && (
            <div className="setting-item">
              <span>Quality</span>
              <GlassSelect
                value={activeLevel}
                options={[
                  { label: "Auto", value: -1 },
                  ...levels.map((l) => ({ label: l.label, value: l.index })),
                ]}
                onChange={handleQualityChange}
              />
            </div>
          )}

          {/* Subtitles */}
          {subtitles.length > 0 && (
            <div className="setting-item">
              <span>Subtitles</span>
              <GlassSelect
                value={activeSubtitle}
                options={[
                  { label: "Off", value: -1 },
                  ...subtitles.map((s, idx) => ({
                    label: s.label || `Track ${idx + 1}`,
                    value: idx,
                  })),
                ]}
                onChange={handleSubtitleChange}
              />
            </div>
          )}

          {/* Subtitle Size */}
          <div className="setting-item">
            <span>Subtitle Size</span>
            <GlassSelect
              value={subtitleSize}
              options={SUBTITLE_SIZES.map((s) => ({
                label: s.label,
                value: s.value,
              }))}
              onChange={handleSubtitleSizeChange}
            />
          </div>

          {/* Subtitle Style */}
          <div className="setting-item">
            <span>Subtitle Style</span>
            <GlassSelect
              value={subtitleStyle}
              options={SUBTITLE_STYLES.map((s) => ({
                label: s.label,
                value: s.value,
              }))}
              onChange={handleSubtitleStyleChange}
            />
          </div>

          {/* Subtitle Position */}
          <div className="setting-item">
            <span>Subtitle Position</span>
            <GlassSelect
              value={subtitlePosition}
              options={SUBTITLE_POSITIONS.map((p) => ({
                label: p.label,
                value: p.value,
              }))}
              onChange={handleSubtitlePositionChange}
            />
          </div>

          {/* Subtitle Live Preview Box */}
          <div className="mx-4 my-2.5 p-2.5 rounded-2xl bg-black/60 border border-white/10 shadow-inner">
            <div className="flex justify-between items-center mb-1.5 px-0.5">
              <span className="text-[10px] font-mono text-white/50 uppercase tracking-wider">
                Subtitle Live Preview
              </span>
              <span className="text-[10px] font-mono text-cyan-400 capitalize">
                {subtitlePosition} · {subtitleSize}
              </span>
            </div>
            <div className="relative h-16 w-full rounded-xl bg-gradient-to-b from-neutral-900/90 to-black/95 border border-white/5 overflow-hidden flex flex-col justify-between p-1.5">
              <div
                className={`w-full flex justify-center h-full ${
                  subtitlePosition === "top"
                    ? "items-start"
                    : subtitlePosition === "raised"
                    ? "items-center"
                    : "items-end"
                }`}
              >
                <span
                  className="px-2.5 py-0.5 rounded transition-all duration-150 text-center select-none"
                  style={{
                    fontSize:
                      SUBTITLE_SIZES.find((s) => s.value === subtitleSize)
                        ?.cssSize || "1.05rem",
                    color:
                      SUBTITLE_STYLES.find((s) => s.value === subtitleStyle)
                        ?.color || "#ffffff",
                    backgroundColor:
                      SUBTITLE_STYLES.find((s) => s.value === subtitleStyle)?.bg ||
                      "rgba(10, 11, 12, 0.85)",
                    textShadow:
                      SUBTITLE_STYLES.find((s) => s.value === subtitleStyle)
                        ?.shadow || "none",
                  }}
                >
                  Anime Subtitle Preview
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download Quality Selection Modal */}
      {downloadModalOpen && (
        <>
          <div
            className="download-modal-backdrop"
            onClick={() => setDownloadModalOpen(false)}
          />
          <div className="download-modal animate-scale-in">
            {/* Modal Header */}
            <div className="download-modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white shrink-0 shadow-inner">
                  <DownloadIcon />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Download Anime
                  </h3>
                  <p className="text-[11px] text-white/60 truncate">
                    {title}
                  </p>
                </div>
              </div>
              <button
                className="close-settings"
                onClick={() => setDownloadModalOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Audio Type Selector (SUB / DUB) */}
            {availableServers.sub?.length > 0 && availableServers.dub?.length > 0 && (
              <div className="px-5 pt-3">
                <div className="flex items-center bg-black/60 p-1 rounded-full border border-white/12">
                  <button
                    onClick={() => setDownloadAudioType("sub")}
                    className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
                      downloadAudioType === "sub"
                        ? "bg-white text-black shadow-md"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    SUB ({availableServers.sub.length})
                  </button>
                  <button
                    onClick={() => setDownloadAudioType("dub")}
                    className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all ${
                      downloadAudioType === "dub"
                        ? "bg-white text-black shadow-md"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    DUB ({availableServers.dub.length})
                  </button>
                </div>
              </div>
            )}

            {/* Quality & Server Buttons */}
            <div className="download-modal-body">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">
                  Select Media Quality
                </span>
                <span className="text-[10px] font-mono text-cyan-400 uppercase">
                  {downloadAudioType}
                </span>
              </div>

              {(() => {
                const currentServers =
                  (downloadAudioType === "dub"
                    ? availableServers.dub
                    : availableServers.sub) || [];

                if (currentServers.length === 0) {
                  return (
                    <div className="text-center py-4">
                      <p className="text-xs text-white/60 mb-3">
                        No separate quality options found for {downloadAudioType.toUpperCase()}.
                      </p>
                      <button
                        onClick={() => triggerDownload(streamUrl, "Current")}
                        className="download-quality-btn justify-center text-center font-semibold text-xs"
                      >
                        Download Current Stream
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto pr-1">
                    {currentServers.map((srv, idx) => {
                      // Match stream from streams array by url/linkId or quality name
                      const matchedStream =
                        streams.find(
                          (s) =>
                            s.url === srv.linkId ||
                            s.quality === srv.name ||
                            s.quality === srv.quality
                        ) ||
                        streams.find((s) => s.proxyUrl === srv.linkId);

                      const targetProxyUrl =
                        matchedStream?.proxyUrl ||
                        (matchedStream?.url ? matchedStream.url : null) ||
                        srv.linkId ||
                        streamUrl;

                      return (
                        <button
                          key={srv.linkId || idx}
                          onClick={() => triggerDownload(targetProxyUrl, srv.name)}
                          className="download-quality-btn group"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 group-hover:scale-125 transition-transform shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                            <div className="text-left truncate">
                              <span className="block font-semibold text-xs text-white group-hover:text-cyan-300 transition-colors truncate">
                                {srv.name}
                              </span>
                              <span className="block text-[10px] text-white/40 font-mono">
                                {downloadAudioType.toUpperCase()} · Stream
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-white/50 px-2 py-0.5 rounded-md bg-white/10 group-hover:bg-white/20 transition-colors">
                              Download
                            </span>
                            <DownloadIcon />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}

      {/* Bottom Controls Bar */}
      <div
        className="ctrl-ctr"
        style={{
          opacity: controlsVisible || !playing ? 1 : 0,
          pointerEvents: controlsVisible || !playing ? "auto" : "none",
        }}
      >
        <div className="ctrls">
          {/* Liquid Glass Progress Bar */}
          <div
            className="prog-bar"
            ref={progressRef}
            onClick={handleProgressClick}
            onMouseMove={handleProgressMouseMove}
            onMouseLeave={handleProgressMouseLeave}
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouch}
            onTouchMove={handleProgressTouch}
          >
            <div className="prog-buffer" style={{ width: `${bufferedPct}%` }} />
            <div className="prog" style={{ width: `${progressPct}%` }} />
            {hoverPos !== null && (
              <div
                className="prev-tt"
                style={{ left: `${hoverPos.pct * 100}%` }}
              >
                {fmtTime(hoverPos.time)}
              </div>
            )}
          </div>

          {/* Button Row */}
          <div className="btn-ctr">
            {/* Left Controls */}
            <div className="l-ctrls">
              {/* Play / Pause button */}
              <LiquidGlass
                className="ctrl-btn play-pause"
                onClick={togglePlay}
                title={playing ? "Pause (Space)" : "Play (Space)"}
              >
                {playing ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-3.5 h-3.5 md:w-5 md:h-5"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-3.5 h-3.5 md:w-5 md:h-5 ml-0.5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </LiquidGlass>

              {/* Volume Capsule Control */}
              <div className="vol-ctr" ref={volumeCtrRef}>
                <LiquidGlass
                  className="ctrl-btn volume"
                  onClick={toggleMute}
                  title={muted ? "Unmute (M)" : "Mute (M)"}
                >
                  <VolumeIcon muted={muted} volume={volume} />
                </LiquidGlass>
                {/* Vertical Slider Capsule */}
                <div
                  className={`vol-sld ${isDraggingVolume ? "is-active" : ""}`}
                  ref={volumeSliderRef}
                  onPointerDown={handleVolumePointerDown}
                  onPointerMove={handleVolumePointerMove}
                  onPointerUp={handleVolumePointerUp}
                  style={{
                    "--volume-level": `${(muted ? 0 : volume) * 100}%`,
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
                          top: `${(1 - (muted ? 0 : volume)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Time Display Capsule */}
              <LiquidGlass className="time-display">
                <div className="time">
                  <span className="current-time">{fmtTime(currentTime)}</span>
                  {" / "}
                  <span className="duration">{fmtTime(duration)}</span>
                </div>
              </LiquidGlass>
            </div>

            {/* Right Controls */}
            <div className="r-ctrls">
              <LiquidGlass className="r-ctrls-btns">
                {/* Settings Toggle */}
                <button
                  className="ctrl-btn settings-btn"
                  onClick={() => setSettingsOpen((prev) => !prev)}
                  title="Settings"
                >
                  <SettingsIcon />
                </button>

                {/* Picture-in-Picture */}
                <button
                  className="ctrl-btn pip-btn"
                  onClick={handlePiP}
                  title="Picture-in-Picture (P)"
                >
                  <PiPIcon />
                </button>

                {/* Fullscreen */}
                <button
                  className="ctrl-btn fs-btn"
                  onClick={handleFullscreen}
                  title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                >
                  {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
                </button>
              </LiquidGlass>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
