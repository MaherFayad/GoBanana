"use client";

/**
 * Top bar above the canvas (spec section 3): 36px on the shell background. Title and
 * "on {appName}", the zoom group, the save status (dot plus words), Upload, Share and Delete
 * canvas on the web (owner only), and the shortcut sheet button. It sits outside the board, so it never covers a
 * focused item (SC 2.4.11). Insert tools live in the notch on the board (canvas/Notch.tsx).
 *
 * On the web and shared canvas (`windowChrome`) the bar is the title bar of an app window:
 * traffic lights first (canvas/WindowLights.tsx), then the same controls. Inline in chat the
 * host frames the view, so there are no lights.
 *
 * Narrow screens (720px and under) keep one row: lights, the board name, the save dot (its words
 * stay for screen readers), Results, then "More", a disclosure that drops the zoom group,
 * Upload, Share, Delete canvas and the shortcut button into a small glass panel. The controls are the same
 * elements in both layouts (the panel is `display: contents` on wide screens), so every
 * shortcut, dialog and test hook keeps working. The panel stays open while a dialog it opened is
 * up, so focus can return to its button.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Plan } from "@/lib/quota";
import { ShortcutKeys } from "@/components/studio/Kbd";
import { Tooltip } from "@/components/studio/Tooltip";
import type { SaveStatus } from "./autosave";
import { HelpIcon, MoreIcon, SearchIcon, WarningIcon } from "./icons";
import { DeleteCanvasButton } from "./DeleteCanvasButton";
import { ShareButton } from "./ShareButton";
import { UploadButton } from "./UploadButton";
import { WindowLights, type WindowLightsProps } from "./WindowLights";
import { ZoomMenu, type ZoomActions } from "./ZoomMenu";

export interface ToolbarProps {
  appName: string;
  title: string;
  readOnly: boolean;
  saveStatus: SaveStatus;
  onRetrySave: () => void;
  zoom: ZoomActions;
  /** Opens the shortcut sheet. */
  onHelp: () => void;
  /** Compact frames hide the rail; this button opens the search results instead. */
  results?: { open: boolean; count: number; controls: string; onToggle: () => void };
  /**
   * Web canvas only (`/c/:id`): set it to show Upload and Share. Leave it unset inline
   * (MCP Apps), where the iframe has no web session to upload or share with.
   */
  canvasId?: string;
  /**
   * Signed-in user's plan for the upgrade note. Pass `effectivePlan(user.plan)` from the
   * server (BETA_PLAN is not readable in the browser). Unknown lets the server decide.
   */
  plan?: Plan | null;
  /** Current share token, if the canvas is shared. */
  shareToken?: string | null;
  /** Link for upgrade notes, for example "/en/pricing". */
  pricingHref?: string;
  /** Web canvas only: the canvases dashboard. Shows "Delete canvas", which goes there when done. */
  dashboardHref?: string;
  /** Web and shared canvas: draw the bar as a window title bar with traffic lights. */
  windowChrome?: WindowLightsProps;
  /** Page extras at the bar's end, always visible (the shared canvas's "Add to Claude"). */
  end?: ReactNode;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "All changes saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Could not save",
};

export function Toolbar(p: ToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Close the narrow-screen panel on a press outside it, unless a dialog it opened is up.
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || moreRef.current?.contains(target)) return;
      if (document.querySelector("dialog[open]")) return;
      setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [moreOpen]);

  return (
    <header className="bn-toolbar">
      {p.windowChrome && <WindowLights {...p.windowChrome} />}
      <h1 className="bn-toolbar-title">
        <span className="bn-toolbar-title-text">{p.title}</span> <span className="bn-toolbar-app">on {p.appName}</span>
      </h1>

      {p.readOnly ? (
        <span className="bn-status" data-status="view" data-testid="save-status">
          View only
        </span>
      ) : (
        <span className="bn-status" role="status" data-status={p.saveStatus} data-testid="save-status">
          {p.saveStatus === "error" ? <WarningIcon size={16} /> : <span className="bn-status-dot" aria-hidden="true" />}
          <span className="bn-status-text">{STATUS_TEXT[p.saveStatus]}</span>
          {p.saveStatus === "error" && (
            <button type="button" className="st-btn" data-variant="secondary" data-size="xs" onClick={p.onRetrySave}>
              Try again
            </button>
          )}
        </span>
      )}

      {p.results && (
        <button
          type="button"
          className="st-btn bn-results-btn"
          data-variant="ghost"
          aria-pressed={p.results.open}
          aria-controls={p.results.open ? p.results.controls : undefined}
          onClick={p.results.onToggle}
        >
          <SearchIcon size={16} />
          <span>Results ({p.results.count})</span>
        </button>
      )}

      <span className="bn-toolbar-spacer" />

      <button
        ref={moreRef}
        type="button"
        className="st-btn bn-more-btn"
        data-variant="ghost"
        data-icon-only=""
        aria-label="More"
        aria-expanded={moreOpen}
        aria-controls={panelId}
        onClick={() => setMoreOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !moreOpen) return;
          e.stopPropagation();
          setMoreOpen(false);
        }}
      >
        <MoreIcon size={16} />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        className="bn-toolbar-more"
        data-open={moreOpen ? "" : undefined}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || document.querySelector("dialog[open], [role='menu']")) return;
          e.stopPropagation();
          setMoreOpen(false);
          moreRef.current?.focus();
        }}
      >
        <ZoomMenu {...p.zoom} />

        {!p.readOnly && p.canvasId && (
          <>
            <span className="bn-toolbar-sep" aria-hidden="true" />
            <div className="bn-toolbar-group" role="group" aria-label="Upload and share">
              <UploadButton plan={p.plan} pricingHref={p.pricingHref} />
              <ShareButton canvasId={p.canvasId} initialToken={p.shareToken ?? null} plan={p.plan} pricingHref={p.pricingHref} />
            </div>
            {p.dashboardHref && <DeleteCanvasButton canvasId={p.canvasId} title={p.title} dashboardHref={p.dashboardHref} />}
          </>
        )}

        <Tooltip content={<>Keyboard shortcuts <ShortcutKeys keys="?" /></>}>
          <button
            type="button"
            className="st-btn"
            data-variant="ghost"
            data-icon-only=""
            aria-label="Keyboard shortcuts"
            aria-haspopup="dialog"
            aria-keyshortcuts="?"
            onClick={p.onHelp}
          >
            <HelpIcon size={16} />
          </button>
        </Tooltip>
      </div>

      {p.end}
    </header>
  );
}
