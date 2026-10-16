import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // the API server (npm run server) runs on 8787 in development
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
