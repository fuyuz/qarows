import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5177,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 5176,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // React + router + nuqs together (avoids circular chunks / duplicate React).
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("scheduler") ||
            id.includes("nuqs") ||
            /[/\\](react|use-sync-external-store)[/\\]/.test(id)
          ) {
            return "react-vendor";
          }
          if (id.includes("@radix-ui") || id.includes("/radix-ui/")) return "radix";
          if (id.includes("lucide-react")) return "icons";
          if (id.includes("js-yaml")) return "yaml";
          if (id.includes(`${path.sep}diff${path.sep}`) || id.endsWith(`${path.sep}diff`)) {
            return "diff";
          }
          // Leave other deps to Rollup — a catch-all "vendor" chunk often cycles with React.
        },
      },
    },
  },
});
