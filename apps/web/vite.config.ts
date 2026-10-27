import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/*.png"],
      manifest: {
        name: "Setu",
        short_name: "Setu",
        description: "Adaptive learning that finds the gap before the chapter begins.",
        lang: "en",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#0f766e",
        background_color: "#f0fdfa",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/packs\//, /^\/api\//],
        runtimeCaching: [
          {
            // Content packs are immutable per packVersion; the data layer (3.1) requests
            // /packs/<chapterId>.json?v=<packVersion>, so each version is its own cache entry.
            urlPattern: ({ url }) =>
              url.pathname.startsWith("/packs/") && url.pathname.endsWith(".json"),
            handler: "CacheFirst",
            options: {
              cacheName: "setu-packs",
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
