/**
 * The R2 binding for user uploads (`R2_BUCKET` in wrangler.jsonc). Read through
 * OpenNext's getCloudflareContext() at request time; under `next dev`,
 * initOpenNextCloudflareForDev() in next.config.ts provides a local bucket.
 */
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { R2Like } from "./types";

/** The bucket, or null when the binding or the Cloudflare context is missing. */
export function getUploadsBucket(): R2Like | null {
  try {
    return (getCloudflareContext().env.R2_BUCKET as R2Like | undefined) ?? null;
  } catch {
    return null;
  }
}
