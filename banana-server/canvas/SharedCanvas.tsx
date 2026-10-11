"use client";

/** View-only canvas for share links (`/s/:token`). Nothing is ever saved. */
import { useMemo } from "react";
import { CanvasApp } from "./CanvasApp";
import { createMemoryPersistence } from "./persistence";
import type { CanvasState } from "./types";

export interface SharedCanvasProps {
  appName: string;
  title: string;
  /** Already takedown filtered on the server, tray removed. */
  state: CanvasState;
}

export function SharedCanvas({ appName, title, state }: SharedCanvasProps) {
  const persistence = useMemo(() => createMemoryPersistence(state), [state]);
  return (
    <div className="bn-page">
      <CanvasApp canvasId="shared" appName={appName} title={title} initialState={state} persistence={persistence} readOnly />
    </div>
  );
}
