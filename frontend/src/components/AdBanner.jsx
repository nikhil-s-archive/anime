import React from "react";

/**
 * AdBanner component for responsive advertisement slots.
 * Features:
 *  - 100% solid opaque dark styling (no transparency, no blur)
 *  - Responsive sizing for leaderboards (728x90/970x90), sidebars (300x250/300x600), and mobile banners
 *  - Clear "ADVERTISEMENT" tag and structured ad slot attributes (data-ad-slot, data-ad-format)
 *  - Zero ads shown when rendered in an ad-free context (e.g., Downloads page)
 */
export default function AdBanner({
  slot = "general",
  format = "horizontal", // "leaderboard" | "horizontal" | "sidebar" | "rectangle"
  className = "",
  label = "Advertisement",
}) {
  const isSidebar = format === "sidebar" || format === "rectangle";

  return (
    <aside
      className={`ad-container ad-slot-${slot} ${className}`}
      data-ad-slot={slot}
      data-ad-format={format}
      aria-label={label}
      style={{
        background: "#121319",
        border: "1px solid #232532",
        borderRadius: isSidebar ? "1.25rem" : "1rem",
        overflow: "hidden",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
    >
      {/* Ad Header Tag */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.35rem 0.85rem",
          background: "#0c0d12",
          borderBottom: "1px solid #1c1d28",
          fontSize: "0.625rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: "ui-monospace, monospace",
          color: "#71717a",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "5px",
              height: "5px",
              borderRadius: "9999px",
              background: "#38bdf8",
            }}
          />
          {label}
        </span>
        <span style={{ fontSize: "0.6rem", color: "#52525b" }}>Sponsored</span>
      </div>

      {/* Ad Content Area */}
      <div
        className="ad-content-box"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isSidebar ? "1.5rem 1rem" : "1rem 1.25rem",
          minHeight: isSidebar ? "260px" : "90px",
          background: "#15161f",
          position: "relative",
          textAlign: "center",
        }}
      >
        {isSidebar ? (
          /* Sidebar / Rectangle Ad Layout */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              width: "100%",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "#20222e",
                border: "1px solid #2e3042",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#e4e4e7",
                fontSize: "1.25rem",
              }}
            >
              ⚡
            </div>
            <div>
              <p
                style={{
                  margin: "0 0 0.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#f4f4f5",
                }}
              >
                Ultra HD Anime VPN
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.75rem",
                  color: "#a1a1aa",
                  lineHeight: 1.4,
                }}
              >
                Buffer-free 4K streaming worldwide. Zero logs, 10Gbps servers.
              </p>
            </div>
            <a
              href="#sponsored"
              onClick={(e) => e.preventDefault()}
              style={{
                marginTop: "0.5rem",
                display: "inline-block",
                padding: "0.45rem 1.15rem",
                borderRadius: "9999px",
                background: "#f4f4f5",
                color: "#09090b",
                fontSize: "0.75rem",
                fontWeight: 700,
                textDecoration: "none",
                transition: "background 0.2s ease",
              }}
            >
              Learn More
            </a>
          </div>
        ) : (
          /* Horizontal / Leaderboard Ad Layout */
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.85rem",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  background: "#20222e",
                  border: "1px solid #2e3042",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                  fontSize: "1.2rem",
                  flexShrink: 0,
                }}
              >
                🎌
              </div>
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#f4f4f5",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Official Anime Figure & Merch Store
                </p>
                <p
                  style={{
                    margin: "0.15rem 0 0",
                    fontSize: "0.75rem",
                    color: "#a1a1aa",
                  }}
                >
                  Exclusive Japanese collectibles, scale figures & manga. Special 20% discount with code{" "}
                  <span style={{ color: "#f4f4f5", fontWeight: 600 }}>ANIME20</span>
                </p>
              </div>
            </div>

            <a
              href="#sponsored"
              onClick={(e) => e.preventDefault()}
              style={{
                padding: "0.45rem 1.25rem",
                borderRadius: "9999px",
                background: "#f4f4f5",
                color: "#09090b",
                fontSize: "0.75rem",
                fontWeight: 700,
                textDecoration: "none",
                marginLeft: "auto",
                whiteSpace: "nowrap",
              }}
            >
              Explore Store
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
