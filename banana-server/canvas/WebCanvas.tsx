"use client";

/**
 * Full-screen web canvas (`/c/:id`). Saves through fetch to `/api/canvas/:id`, sending the
 * version it started from, so a save never overwrites newer changes made in another window
 * or by the agent. On a conflict, saving stops and a plain message asks for a reload.
 */
import { useMemo, useState } from "react";
import { CanvasApp } from "./CanvasApp";
import { CONFLICT_MESSAGE, createFetchPersistence, isConflict, type CanvasPersistence } from "./persistence";
import type { CanvasState } from "./types";
import type { Plan } from "@/lib/quota";

export interface WebCanvasProps {
  canvasId: string;
  appName: string;
  title: string;
  /** Server-loaded state (already takedown filtered), or null to load from the API. */
  initialState: CanvasState | null;
  /** `updatedAt` of `initialState`, sent as `baseUpdatedAt` on the first save. */
  initialUpdatedAt?: string | null;
  readOnly?: boolean;
  /** Effective plan (`effectivePlan(user.plan)`, BETA_PLAN applied), for upgrade notes. */
  plan?: Plan | null;
  /** Current share token, for the Share button. */
  shareToken?: string | null;
  /** Pricing page link for upgrade notes. */
  pricingHref?: string;
}

export function WebCanvas({
  canvasId,
  appName,
  title,
  initialState,
  initialUpdatedAt,
  readOnly = false,
  plan = null,
  shareToken = null,
  pricingHref = "/en/pricing",
}: WebCanvasProps) {
  const [conflict, setConflict] = useState(false);
  const persistence = useMemo<CanvasPersistence>(() => {
    const inner = createFetchPersistence(canvasId, { baseUpdatedAt: initialUpdatedAt ?? null });
    return {
      load: () => inner.load(),
      async save(state) {
        try {
          await inner.save(state);
        } catch (error) {
          if (isConflict(error)) setConflict(true);
          throw error;
        }
      },
    };
  }, [canvasId, initialUpdatedAt]);

  return (
    <div className="bn-page">
      {conflict && (
        <div className="bn-conflict" role="alert">
          <p>{CONFLICT_MESSAGE}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )}
      <CanvasApp
        canvasId={canvasId}
        appName={appName}
        title={title}
        initialState={initialState ?? undefined}
        persistence={persistence}
        readOnly={readOnly}
        web={{ plan, shareToken, pricingHref }}
      />
    </div>
  );
}
