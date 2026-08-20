import tailwindcss from "@tailwindcss/vite"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import jotaiDebugLabel from "jotai/babel/plugin-debug-label"
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh"
import { visualizer } from "rollup-plugin-visualizer"
import type { PluginOption } from "vite"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import { VitePWA } from "vite-plugin-pwa"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    TanStackRouterVite(),
    react({ babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] } }),
    visualizer({ filename: "dist/stats.html" }) as unknown as PluginOption,
    VitePWA({
      strategies: "generateSW",
      registerType: "prompt",
      injectRegister: "auto",
      manifest: {
        name: "Percolate",
        short_name: "Percolate",
        description: "A block-based note-taking app for better thinking",
        theme_color: "#000000",
        background_color: "#000000",
        icons: [
          {
            src: "icon-1024.png",
            sizes: "1024x1024",
            type: "image/png",
          },
        ],
        start_url: "/",
        display: "standalone",
      },
      workbox: {
        globPatterns: ["**/*.{html,css,js,woff2}"],
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
        skipWaiting: true,
        navigateFallback: "index.html",
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        sourcemap: true,
        // Do not cache function routes
        navigateFallbackDenylist: [/cors-proxy/, /file-proxy/, /git-lfs-file/, /github-auth/],
      },
      devOptions: {
        enabled: process.env.NODE_ENV === "development",
        type: "module",
      },
    }),
    // Fixes isomorphic-git Buffer error
    // https://github.com/isomorphic-git/isomorphic-git/issues/1753
    nodePolyfills(),
  ],
  build: {
    // CodeMirror and the full markdown/unified stack are legitimately large;
    // 500 kB is unrealistic for an editor app. The vendors are split below for
    // caching, and this raises the warning threshold to a sane value.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks so the main bundle stays
        // smaller and third-party code is cached independently of app code.
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (
            /[\\/](@codemirror|@uiw|@lezer|@replit[\\/]codemirror-vim|codemirror|prismjs)[\\/]/.test(
              id,
            )
          )
            return "codemirror"
          if (
            /[\\/](unified|remark-[^\\/]+|rehype-[^\\/]+|mdast[^\\/]*|micromark[^\\/]*|hast[^\\/]*|katex|refractor|property-information|vfile[^\\/]*|unist[^\\/]*|character-entities[^\\/]*|decode-named-character-reference)[\\/]/.test(
              id,
            )
          )
            return "markdown"
          if (/[\\/](react|react-dom|scheduler|@tanstack|jotai|xstate)[\\/]/.test(id))
            return "react"
          return "vendor"
        },
      },
    },
  },
})
