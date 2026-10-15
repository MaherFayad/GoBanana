import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Server files atlas-build reads (the Atlas loader in tests, the shared lists in jobs) use the
// server's "@/" alias.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("../banana-server", import.meta.url)) } },
});
