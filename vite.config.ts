import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "icon-192.png"],
      manifest: {
        id: "/",
        name: "Loggi",
        short_name: "Loggi",
        description:
          "A shared care log for dog households — feeding, walks, toilet breaks, medication and more.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en",
        dir: "ltr",
        categories: ["lifestyle", "health", "productivity"],
        theme_color: "#7c5c3e",
        background_color: "#fdf6ee",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
