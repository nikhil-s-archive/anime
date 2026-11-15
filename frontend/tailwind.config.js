/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // AnimeX strict palette
        navy: {
          DEFAULT: "#0D3A5C",
          50: "#e8f1f8",
          100: "#c5dcee",
          200: "#9ec4e3",
          300: "#77acd7",
          400: "#5898cf",
          500: "#3985c6",
          600: "#2d72b0",
          700: "#1f5a8c",
          800: "#14456C",
          900: "#0D3A5C",
          950: "#081e30",
        },
        azure: "#1B5A8C",
        gold: {
          DEFAULT: "#C9A24B",
          light: "#dbb96a",
          dark: "#a8832c",
        },
        ivory: {
          DEFAULT: "#FAF7F0",
          dim: "#ede9e0",
          muted: "#c8c4bc",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "Fira Code", "ui-monospace", "monospace"],
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(13, 58, 92, 0.37)",
        "glass-hover": "0 12px 40px 0 rgba(13, 58, 92, 0.55)",
        "gold-glow": "0 0 20px rgba(201, 162, 75, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s ease-out",
        shimmer: "shimmer 1.5s infinite",
        "pulse-gold": "pulseGold 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        pulseGold: {
          "0%, 100%": { boxShadow: "0 0 10px rgba(201, 162, 75, 0.2)" },
          "50%": { boxShadow: "0 0 24px rgba(201, 162, 75, 0.6)" },
        },
      },
    },
  },
  plugins: [],
};
