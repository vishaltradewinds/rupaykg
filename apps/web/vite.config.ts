import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CI smoke uses the production preview and runner Chromium before release.
  build: { outDir: "dist", emptyOutDir: true },
});
