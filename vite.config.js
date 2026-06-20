import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa dependências grandes em chunks próprios
          // para melhor cache no browser
          supabase: ["@supabase/supabase-js"],
          react:    ["react", "react-dom"],
        },
      },
    },
  },
  // Garante que variáveis VITE_ ficam disponíveis
  envPrefix: "VITE_",
});
