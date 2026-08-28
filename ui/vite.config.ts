import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Tauri sabit portta bekliyor; rastgele port seçilirse geliştirme
// sunucusuna bağlanamaz.
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    // Tauri kendi WebView'ini kullanıyor; eski tarayıcı desteği gereksiz.
    target: "chrome110",
    minify: "esbuild",
    sourcemap: false,
  },
});
