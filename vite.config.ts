import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const DEV_SERVER_PORT = 1420;

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**", "**/crates/**"] },
  },
  build: {
    target: "safari16",
    outDir: "dist",
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["src/testSetup.ts"],
  },
});
