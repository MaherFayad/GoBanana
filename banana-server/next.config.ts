import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Hard rule 2: never re-host third-party images. Next's image optimizer would
  // proxy and cache image bytes through our server, so it stays off.
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default nextConfig;

// Gives `next dev` access to Worker bindings (R2) through getCloudflareContext().
initOpenNextCloudflareForDev();
