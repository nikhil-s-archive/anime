import React, { useState, useEffect, useMemo } from "react";

/**
 * Adsterra Ad Unit Configurations provided by the user:
 * 1. 320x50  - Mobile Leaderboard
 * 2. 728x90  - Desktop Leaderboard
 * 3. 160x600 - Wide Skyscraper
 * 4. 160x300 - Skyscraper / Half
 * 5. 300x250 - Medium Rectangle
 * 6. 468x60  - Tablet / Medium Banner
 * 7. Global Tag (Popunder / Social bar)
 */
export const ADSTERRA_UNITS = {
  "320x50": {
    id: "320x50",
    key: "9eda2e2665a06610516222507dd3a94f",
    format: "iframe",
    height: 50,
    width: 320,
    scriptSrc: "https://bauval.org/22/9eda2e2665a06610516222507dd3a94f",
  },
  "728x90": {
    id: "728x90",
    key: "175f1b47a9bae5a8b8054d388fea4075",
    format: "iframe",
    height: 90,
    width: 728,
    scriptSrc: "https://bauval.org/22/175f1b47a9bae5a8b8054d388fea4075",
  },
  "160x600": {
    id: "160x600",
    key: "1e3edbf45542806a22e02ca32288112a",
    format: "iframe",
    height: 600,
    width: 160,
    scriptSrc: "https://bauval.org/22/1e3edbf45542806a22e02ca32288112a",
  },
  "160x300": {
    id: "160x300",
    key: "8c34de51d59fce073e7825e507d6388a",
    format: "iframe",
    height: 300,
    width: 160,
    scriptSrc: "https://bauval.org/22/8c34de51d59fce073e7825e507d6388a",
  },
  "300x250": {
    id: "300x250",
    key: "68a8c08c40a0695aa49aa64fdf5d497c",
    format: "iframe",
    height: 250,
    width: 300,
    scriptSrc: "https://bauval.org/22/68a8c08c40a0695aa49aa64fdf5d497c",
  },
  "468x60": {
    id: "468x60",
    key: "6f8fe6c4560729092553a9dadbcfdaf4",
    format: "iframe",
    height: 60,
    width: 468,
    scriptSrc: "https://bauval.org/22/6f8fe6c4560729092553a9dadbcfdaf4",
  },
};

export const ADSTERRA_GLOBAL_TAG =
  "https://bauval.org/14/49a02958d0b91f5953a953d97de73003";

/**
 * Generates an isolated HTML document for an Adsterra iframe ad.
 * Running Adsterra scripts inside an isolated iframe prevents document.write()
 * from affecting the main React application and guarantees atOptions scoping.
 */
function generateAdHtml(unit) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${unit.key}',
      'format' : 'iframe',
      'height' : ${unit.height},
      'width' : ${unit.width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="${unit.scriptSrc}"></script>
</body>
</html>`;
}

/**
 * AdsterraGlobalScript component
 * Injects the Adsterra popunder / social bar script into the document body
 * when enabled, and automatically removes it when disabled (e.g. on downloads page).
 */
export function AdsterraGlobalScript({ enabled = true }) {
  useEffect(() => {
    if (!enabled) {
      const existing = document.getElementById("adsterra-global-tag");
      if (existing) existing.remove();
      return;
    }

    if (document.getElementById("adsterra-global-tag")) return;

    const script = document.createElement("script");
    script.id = "adsterra-global-tag";
    script.src = ADSTERRA_GLOBAL_TAG;
    script.setAttribute("data-cfasync", "false");
    script.async = true;
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById("adsterra-global-tag");
      if (s) s.remove();
    };
  }, [enabled]);

  return null;
}

/**
 * AdBanner component for displaying Adsterra ads with:
 * - 100% solid, opaque dark styling (no transparency, no blur)
 * - Automatic responsive unit switching (728x90 on desktop, 468x60 on tablet, 320x50 on mobile)
 * - Fixed unit support (300x250, 160x600, 160x300) for player companion sidebar
 * - Completely isolated iframes to prevent SPA conflicts
 */
export default function AdBanner({
  slot = "general",
  format = "horizontal", // "horizontal" | "leaderboard" | "rectangle" | "skyscraper" | "vertical"
  unit: unitProp = null, // Optional explicit unit override
  className = "",
  label = "Advertisement",
}) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Determine active Adsterra ad unit
  let activeUnit = null;
  if (unitProp && ADSTERRA_UNITS[unitProp]) {
    activeUnit = ADSTERRA_UNITS[unitProp];
  } else if (format === "rectangle" || format === "300x250") {
    activeUnit = ADSTERRA_UNITS["300x250"];
  } else if (format === "skyscraper" || format === "160x600") {
    activeUnit = ADSTERRA_UNITS["160x600"];
  } else if (format === "vertical" || format === "160x300") {
    activeUnit = ADSTERRA_UNITS["160x300"];
  } else if (format === "mobile" || format === "320x50") {
    activeUnit = ADSTERRA_UNITS["320x50"];
  } else {
    // Responsive horizontal banner:
    if (windowWidth < 500) {
      activeUnit = ADSTERRA_UNITS["320x50"];
    } else if (windowWidth < 768) {
      activeUnit = ADSTERRA_UNITS["468x60"];
    } else {
      activeUnit = ADSTERRA_UNITS["728x90"];
    }
  }

  const html = useMemo(() => generateAdHtml(activeUnit), [activeUnit]);

  // Handle small mobile viewports where banner width might exceed screen width
  const scale =
    windowWidth < activeUnit.width + 24
      ? Math.max(0.75, (windowWidth - 24) / activeUnit.width)
      : 1;

  return (
    <aside
      className={`ad-container ad-slot-${slot} ${className}`}
      data-ad-slot={slot}
      data-ad-key={activeUnit.key}
      data-ad-size={`${activeUnit.width}x${activeUnit.height}`}
      aria-label="Advertisement"
      style={{
        background: "#121319",
        border: "1px solid #232532",
        borderRadius: "0.75rem",
        overflow: "hidden",
        width: "fit-content",
        maxWidth: "100%",
        margin: "0 auto",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      {/* Ad Header Tag: Advertisement with Red Dot */}
      <div
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.25rem 0.6rem",
          background: "#0c0d12",
          borderBottom: "1px solid #1c1d28",
          fontSize: "0.625rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          color: "#8e8e93",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "9999px",
              background: "#ef4444",
              boxShadow: "0 0 6px rgba(239, 68, 68, 0.7)",
              flexShrink: 0,
            }}
          />
          <span>Advertisement</span>
        </span>
      </div>

      {/* Ad Content Box: Exact fit to ad size */}
      <div
        className="ad-iframe-wrapper"
        style={{
          width: scale < 1 ? `${Math.round(activeUnit.width * scale)}px` : `${activeUnit.width}px`,
          height: scale < 1 ? `${Math.round(activeUnit.height * scale)}px` : `${activeUnit.height}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#15161f",
          overflow: "hidden",
          padding: 0,
        }}
      >
        <div
          style={{
            width: `${activeUnit.width}px`,
            height: `${activeUnit.height}px`,
            transform: scale < 1 ? `scale(${scale})` : "none",
            transformOrigin: "center center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <iframe
            key={`${activeUnit.key}-${activeUnit.width}x${activeUnit.height}`}
            title={`adsterra-${activeUnit.key}`}
            srcDoc={html}
            width={activeUnit.width}
            height={activeUnit.height}
            scrolling="no"
            style={{
              border: 0,
              width: `${activeUnit.width}px`,
              height: `${activeUnit.height}px`,
              display: "block",
              margin: 0,
              padding: 0,
              overflow: "hidden",
            }}
          />
        </div>
      </div>
    </aside>
  );
}
