import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Las pruebas que levantan el servidor MCP abren un proceso hijo.
    testTimeout: 20_000,
    include: ["tests/**/*.test.ts"],
  },
});
