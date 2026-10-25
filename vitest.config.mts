import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    dedupe: ["react", "react-dom", "lucide-react"],
    alias: [
      { find: "@", replacement: path.resolve(import.meta.dirname, "./src") },
      { find: "react", replacement: path.resolve(import.meta.dirname, "./node_modules/react") },
      { find: "react-dom", replacement: path.resolve(import.meta.dirname, "./node_modules/react-dom") },
      { find: "lucide-react", replacement: path.resolve(import.meta.dirname, "./node_modules/lucide-react") },
    ],
  },
});
