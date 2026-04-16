import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("cytoscape") ||
            id.includes("react-cytoscapejs")
          ) {
            return "graph-vendor";
          }

          if (id.includes("pdfjs-dist") || id.includes("pdf-parse")) {
            return "pdf-vendor";
          }

          if (id.includes("recharts")) {
            return "charts-vendor";
          }

          if (id.includes("react-markdown")) {
            return "markdown-vendor";
          }

          if (
            id.includes("react-dom") ||
            id.includes("react-router-dom") ||
            id.includes("/react/")
          ) {
            return "react-vendor";
          }

          if (id.includes("@radix-ui")) {
            return "radix-vendor";
          }

          if (id.includes("lucide-react")) {
            return "icons-vendor";
          }

          if (
            id.includes("react-hook-form") ||
            id.includes("@hookform/resolvers") ||
            id.includes("/zod/")
          ) {
            return "forms-vendor";
          }

          return "vendor";
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@components": path.resolve(__dirname, "src/components"),
      "@features": path.resolve(__dirname, "src/features"),
      "@hooks": path.resolve(__dirname, "src/hooks"),
      "@services": path.resolve(__dirname, "src/services"),
    },
  },
  server: {
    host: "0.0.0.0",  // Aceita conexões externas (necessário para Docker)
    port: 3000,
    watch: {
      usePolling: true,  // Necessário para Windows/WSL/Docker
    },
  },
});
