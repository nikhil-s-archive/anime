import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Vite 6: explicitly declare this is a client-side SPA
  appType: "spa",
  server: {
    port: 5173,
    // Proxy API calls to the local Wrangler dev server in development
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
      "/proxy": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    // Vite 6 default target is 'baseline-widely-available'; pin to esnext
    // so hls.js dynamic imports resolve cleanly
    target: "esnext",
  },
});
