import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// MV3 exige assets locais e caminhos relativos: base './' e sem code-splitting
// quebrado. O public/ (manifest + icons) é copiado verbatim para dist/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "chrome110",
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, "popup.html"),
        app: resolve(import.meta.dirname, "app.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks: (id) => {
          if (id.includes("jsqr")) return "qr";
          if (id.includes("node_modules")) return "vendor";
          return null;
        },
      },
    },
  },
});
