import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so it can be opened from a phone during dev
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
});
