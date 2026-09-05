import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CI browser smoke validates the built app through Vite's production preview.
  build: { outDir: "dist", emptyOutDir: true },
});
