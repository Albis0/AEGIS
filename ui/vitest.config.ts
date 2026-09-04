import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Separate from vite.config.ts so the build config stays about building.
// The two share nothing: the app is bundled for a WebView, the tests run
// in jsdom under node.
export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // Svelte 5 runes only work in files the compiler processes, which for
    // plain `.ts` means opting in explicitly.
    server: { deps: { inline: ["svelte"] } },
  },
  resolve: {
    // Vitest would otherwise pick Svelte's server build, where the runes
    // that back the store are inert.
    conditions: ["browser"],
  },
});
