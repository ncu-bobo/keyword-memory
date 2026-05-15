import { fileURLToPath, URL } from "node:url";
import uniModule from "@dcloudio/vite-plugin-uni";
import { defineConfig } from "vite";
import type { Plugin } from "vite";

type UniPluginFactory = () => Plugin[];

const uni = ((uniModule as unknown as { default?: UniPluginFactory }).default ?? uniModule) as UniPluginFactory;

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      "@keyword-memory/core": fileURLToPath(new URL("../../packages/core/src", import.meta.url)),
      "@keyword-memory/supabase": fileURLToPath(new URL("../../packages/supabase/src", import.meta.url))
    }
  }
});
