import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The production build is browser-smoked from CI with `vite preview`.
  build: { outDir: "dist", emptyOutDir: true },
});
