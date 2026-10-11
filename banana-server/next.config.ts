import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Hard rule 2: never re-host third-party images. Next's image optimizer would
  // proxy and cache image bytes through our server, so it stays off.
  images: { unoptimized: true },
  poweredByHeader: false,
  // Left for OpenNext's esbuild step, which resolves them with the `workerd`
  // export condition. Bundled by Next they pick the Ajv JSON Schema validator,
  // which uses `new Function` and crashes on Workers ("Error compiling schema").
  serverExternalPackages: ["@modelcontextprotocol/server", "mcp-handler"],
};

export default nextConfig;

// Gives `next dev` access to Worker bindings (R2) through getCloudflareContext().
initOpenNextCloudflareForDev();
