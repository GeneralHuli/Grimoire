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
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
