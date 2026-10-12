"use client";

/**
 * View-only canvas for share links (`/s/:token`). Nothing is ever saved.
 *
 * Same window chrome as the web canvas, read only: the traffic lights are a picture (a visitor
 * has no dashboard to go back to), apart from full screen where the browser allows it. One bar
 * only: the title bar says "View only" in words (a chip where the save status would be) and
 * carries the page's call to action at its end (`titleEnd`). Every reference keeps its source
 * link (hard rule 3).
 */
import { useMemo, type ReactNode } from "react";
import { ToastProvider } from "@/components/studio/Toast";
import dynamic from "next/dynamic";
import { CanvasSkeletonWindow } from "./CanvasSkeleton";

// The board only runs in the browser: rendered on the server it added React Flow and the whole
// canvas to the Worker bundle (the size budget) for markup the client replaced at once.
// The `typeof window` guard lets the server build drop the import (and its chunk) entirely.
const CanvasApp = dynamic(
  () => (typeof window === "undefined" ? Promise.resolve(() => null) : import("./CanvasApp").then((m) => m.CanvasApp)),
  { ssr: false, loading: () => <CanvasSkeletonWindow /> },
);
import { createMemoryPersistence } from "./persistence";
import type { CanvasState } from "./types";
import "./overlays.css";

export interface SharedCanvasProps {
  appName: string;
  title: string;
  /** Already takedown filtered on the server, tray removed. */
  state: CanvasState;
  /** At the end of the title bar (the share page's "Add to Claude"). */
  titleEnd?: ReactNode;
  /** Page-level extras drawn over the desk (the share page's "Made with" card). */
  children?: ReactNode;
}

export function SharedCanvas({ appName, title, state, titleEnd, children }: SharedCanvasProps) {
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
          titleEnd={titleEnd}
        />
        {children}
      </div>
    </ToastProvider>
  );
}
