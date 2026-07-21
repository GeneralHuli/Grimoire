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
    proxy: {
      "/api": apiProxyTarget,
    },
  },
});
