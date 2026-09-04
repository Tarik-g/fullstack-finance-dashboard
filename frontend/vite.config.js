import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: ["./src/test/setup.js"],
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
