import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/** 古いタブに新しいビルドを知らせるための ID（packages/ui/src/lib/stale-build.ts 参照） */
const buildId = Date.now().toString(36);
const buildVersion: Plugin = {
  name: "qarows-build-version",
  generateBundle() {
    this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify({ buildId }) });
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), buildVersion],
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              debugName: "vendor-chunks",
              name(id) {
                if (!id.includes("node_modules")) return null;
                if (id.includes("@tanstack")) return "tanstack";
                if (id.includes("@radix-ui") || id.includes("/radix-ui/")) return "radix";
                return "vendor";
              },
            },
          ],
        },
      },
    },
  },
});
