import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API server runs on 8787 (server/); in production it also serves this build.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } } },
});
