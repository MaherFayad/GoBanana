/**
 * Install funnel (DIST-08). Four first-times per user, so the owner can see where people drop:
 * the first ping (connected), the first canvas, the first kept direction and the first export.
 * Server counters only: no tracking scripts, no content, one row per user in `install_funnel`.
 *
 * `recordFunnel` never throws and never slows a tool down twice: it skips without DATABASE_URL,
 * remembers what it already wrote in this isolate, and swallows database errors (the funnel is
 * a report, not a feature). The first time wins, so a repeat is harmless.
 */
import { sql } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { installFunnel } from "@/db/schema";
import { getConfig } from "@/lib/config";
import { isUuid } from "@/lib/db/ids";

export const FUNNEL_STEPS = ["ping", "canvas", "keep", "export"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

const COLUMN = {
  ping: installFunnel.firstPingAt,
  canvas: installFunnel.firstCanvasAt,
  keep: installFunnel.firstKeepAt,
  export: installFunnel.firstExportAt,
} as const;

const FIELD = { ping: "firstPingAt", canvas: "firstCanvasAt", keep: "firstKeepAt", export: "firstExportAt" } as const;

export interface FunnelStore {
  /** Sets the step's time to now unless it is already set. */
  mark(userId: string, step: FunnelStep): Promise<void>;
}

export function dbFunnelStore(db: Db): FunnelStore {
  return {
    async mark(userId, step) {
      const column = COLUMN[step];
      await db
        .insert(installFunnel)
        .values({ userId, [FIELD[step]]: sql`now()` })
        .onConflictDoUpdate({
          target: installFunnel.userId,
          set: { [FIELD[step]]: sql`coalesce(${column}, now())` },
        });
    },
  };
}

let override: FunnelStore | null | undefined;
const written = new Set<string>();

/** Tests: use this store instead of the database (null restores the default). Forgets what was written. */
export function setFunnelStore(store: FunnelStore | null): void {
  override = store ?? undefined;
  written.clear();
}

export async function recordFunnel(userId: string | undefined, step: FunnelStep): Promise<void> {
  if (!userId || !isUuid(userId)) return;
  const key = `${userId}:${step}`;
  if (written.has(key)) return;
  try {
    const store = override ?? (getConfig().databaseUrl ? dbFunnelStore(getDb()) : undefined);
    if (!store) return;
    await store.mark(userId, step);
    written.add(key);
  } catch {
    console.error(`[funnel] ${step} not recorded`);
  }
}
