"use client";

/** Full-screen web canvas (`/c/:id`). Saves through fetch to `/api/canvas/:id`. */
import { useMemo } from "react";
import { CanvasApp } from "./CanvasApp";
import { createFetchPersistence } from "./persistence";
import type { CanvasState } from "./types";

export interface WebCanvasProps {
  canvasId: string;
  appName: string;
  title: string;
  /** Server-loaded state (already takedown filtered), or null to load from the API. */
  initialState: CanvasState | null;
  readOnly?: boolean;
}

export function WebCanvas({ canvasId, appName, title, initialState, readOnly = false }: WebCanvasProps) {
  const persistence = useMemo(() => createFetchPersistence(canvasId), [canvasId]);
  return (
    <div className="bn-page">
      <CanvasApp
        canvasId={canvasId}
        appName={appName}
        title={title}
        initialState={initialState ?? undefined}
        persistence={persistence}
        readOnly={readOnly}
      />
    </div>
  );
}
