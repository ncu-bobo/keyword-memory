import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@keyword-memory/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
      "@keyword-memory/supabase": fileURLToPath(new URL("../../packages/supabase/src", import.meta.url))
    }
  },
  build: {
    outDir: "dist"
  }
});
