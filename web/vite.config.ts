import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In Docker Compose, "localhost" inside the web container is the web container itself —
// the server is reachable at its Compose service name instead. VITE_API_PROXY_TARGET
// lets docker-compose.yml override the default for that case.
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Vite's dev server rejects requests whose Host header it doesn't recognize
    // (DNS-rebinding protection) — the LAN domain HAProxy fronts this on must be
    // explicitly allowed, or every request routed through it 403s.
    allowedHosts: ["grimoire.avryw.com"],
    // HAProxy's idle/tunnel timeout kills the long-lived HMR WebSocket every ~30s,
    // which Vite's client treats as a lost connection and responds to with a full
    // page reload once it reconnects — i.e. the page refreshes on a loop. Disabling
    // HMR avoids that; changes still show up, just via a manual browser refresh
    // instead of Fast Refresh.
    hmr: false,
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
