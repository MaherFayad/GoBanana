/**
 * Drizzle over the Neon serverless HTTP driver: one HTTPS request per query,
 * no TCP pool, which is what Cloudflare Workers needs.
 */
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { getConfig } from "@/lib/config";
import * as schema from "./schema";

export type Db = NeonHttpDatabase<typeof schema>;

let cached: { url: string; db: Db } | undefined;

/** Lazily creates the client so importing this module never needs DATABASE_URL. */
export function getDb(): Db {
  const url = getConfig().databaseUrl;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (cached?.url !== url) {
    cached = { url, db: drizzle({ client: neon(url), schema }) };
  }
  return cached.db;
}

export { schema };
