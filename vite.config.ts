import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/** The single public port. Replit maps it to the external URL. */
const CLIENT_PORT = Number(process.env.PORT ?? 5000);
/** Where the Express process moved aside to in development. */
const API_PORT = process.env.API_PORT ?? "5174";

/**
 * Replit terminates TLS on 443 in front of the container, so the HMR client
 * must be told to dial 443 rather than the container port. Applying that
 * unconditionally would break plain-HTTP local development, so it is gated on
 * Replit's own environment variables.
 */
const onReplit = Boolean(process.env.REPL_ID ?? process.env.REPLIT_DEV_DOMAIN);

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
    host: "0.0.0.0",
    port: CLIENT_PORT,
    strictPort: true,
    // Replit serves the dev app from a generated *.replit.dev subdomain; Vite
    // rejects unknown Host headers unless they are listed here.
    allowedHosts: [".replit.dev", ".repl.co", "localhost"],
    ...(onReplit ? { hmr: { clientPort: 443 } } : {}),
    headers: securityHeaders,
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: CLIENT_PORT,
    allowedHosts: [".replit.dev", ".repl.co", "localhost"],
    headers: securityHeaders,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // three.js alone is ~1.1 MB minified; it is already isolated in a
    // route-lazy chunk below, so the default 500 kB warning is just noise.
    chunkSizeWarningLimit: 1200,
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
