declare module "@dcloudio/vite-plugin-uni" {
  import type { Plugin } from "vite";

  const uni: (() => Plugin) | { default: () => Plugin };
  export default uni;
}
