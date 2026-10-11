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
  //
  // zod: the MCP SDK above already brings zod into OpenNext's esbuild bundle. Bundled by
  // Turbopack too, zod was a second copy with every locale (Turbopack keeps all of
  // `z.*`), about 0.3 MB gzipped. External, both share the one esbuild copy, which
  // tree-shakes to what is used (Workers Free caps the Worker at 3 MB gzipped).
  serverExternalPackages: ["@modelcontextprotocol/server", "mcp-handler", "zod"],
};

export default nextConfig;

// Gives `next dev` access to Worker bindings (R2) through getCloudflareContext().
initOpenNextCloudflareForDev();
