"use client";

/**
 * View-only canvas for share links (`/s/:token`). Nothing is ever saved.
 *
 * Same window chrome as the web canvas, read only: the traffic lights are a picture (a visitor
 * has no dashboard to go back to), apart from full screen where the browser allows it. An info
 * alert under the title bar says "View only" in words (the title bar also shows "View only"
 * instead of a save status). Every reference keeps its source link (hard rule 3).
 */
import { useMemo, type ReactNode } from "react";
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
  /** Page-level extras drawn over the desk (the share page's "Made with" card). */
  children?: ReactNode;
}

const VIEW_ONLY = (
  <div className="st-alert" data-tone="info" data-testid="view-only-banner">
    <span className="st-alert-icon">
      <InfoIcon size={16} />
    </span>
    <div className="st-alert-content">
      <p>View only. You cannot change this canvas.</p>
    </div>
  </div>
);

export function SharedCanvas({ appName, title, state, children }: SharedCanvasProps) {
  const persistence = useMemo(() => createMemoryPersistence(state), [state]);
  return (
    <ToastProvider>
      <div className="bn-page" data-desk="">
        <CanvasApp
          canvasId="shared"
          appName={appName}
          title={title}
          initialState={state}
          persistence={persistence}
          readOnly
          windowChrome={{}}
          notice={VIEW_ONLY}
        />
        {children}
      </div>
    </ToastProvider>
  );
}
