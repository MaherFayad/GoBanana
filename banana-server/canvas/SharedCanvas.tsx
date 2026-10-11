"use client";

/**
 * View-only canvas for share links (`/s/:token`). Nothing is ever saved.
 *
 * An info alert above the board says so in words (the top bar also shows "View only"
 * instead of a save status). Every reference keeps its source link (hard rule 3).
 */
import { useMemo } from "react";
import { InfoIcon } from "@/components/studio/icons";
import { ToastProvider } from "@/components/studio/Toast";
import { CanvasApp } from "./CanvasApp";
import { createMemoryPersistence } from "./persistence";
import type { CanvasState } from "./types";
import "./overlays.css";

export interface SharedCanvasProps {
  appName: string;
  title: string;
  /** Already takedown filtered on the server, tray removed. */
  state: CanvasState;
}

export function SharedCanvas({ appName, title, state }: SharedCanvasProps) {
  const persistence = useMemo(() => createMemoryPersistence(state), [state]);
  return (
    <ToastProvider>
      <div className="bn-page">
        <div className="bn-banner">
          <div className="st-alert" data-tone="info" data-testid="view-only-banner">
            <span className="st-alert-icon">
              <InfoIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p>View only. You cannot change this canvas.</p>
            </div>
          </div>
        </div>
        <CanvasApp canvasId="shared" appName={appName} title={title} initialState={state} persistence={persistence} readOnly />
      </div>
    </ToastProvider>
  );
}
