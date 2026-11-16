/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Neutral dark palette with a restrained silver accent.
        navy: {
          DEFAULT: "#08090A",
          50: "#F5F5F7",
          100: "#E5E7EB",
          200: "#D1D5DB",
          300: "#AEB4BB",
          400: "#8C9299",
          500: "#656B72",
          600: "#454A50",
          700: "#292D31",
          800: "#17191C",
          900: "#08090A",
          950: "#050506",
        },
        azure: "#343A40",
        gold: {
          DEFAULT: "#D7DCE2",
          light: "#E8EAED",
          dark: "#AEB4BB",
        },
        ivory: {
          DEFAULT: "#F5F5F7",
          dim: "#E5E7EB",
          muted: "#A1A5AA",
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
        glass: "0 8px 32px rgba(0, 0, 0, 0.3)",
        "glass-hover": "0 12px 40px rgba(0, 0, 0, 0.45)",
        "gold-glow": "0 0 20px rgba(255, 255, 255, 0.12)",
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
          "0%, 100%": { boxShadow: "0 0 10px rgba(255, 255, 255, 0.08)" },
          "50%": { boxShadow: "0 0 24px rgba(255, 255, 255, 0.2)" },
        },
      },
    },
  },
  plugins: [],
};
