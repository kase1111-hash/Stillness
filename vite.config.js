import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite config — proxies /api requests to the Express backend during development.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
