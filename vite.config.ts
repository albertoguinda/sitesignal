import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const API_PORT = process.env.PORT ?? "5174";

/**
 * Headers Vite can emit locally. In production these belong to whatever fronts
 * the Express server (reverse proxy / CDN); `server/index.ts` sets the same set
 * so a single-process deployment is covered too.
 */
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    headers: securityHeaders,
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: { headers: securityHeaders },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // three.js and Recharts are heavy and only needed on two routes; keeping
        // them out of the entry chunk keeps first paint on / cheap.
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("@react-three")) return "three";
          if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) {
            return "charts";
          }
          return undefined;
        },
      },
    },
  },
});
