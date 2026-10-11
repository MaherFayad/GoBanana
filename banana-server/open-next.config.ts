import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default ("dummy") caches: every route here is dynamic, so no incremental
// cache bucket is needed yet. Add r2IncrementalCache if ISR pages are added.
export default defineCloudflareConfig({});
