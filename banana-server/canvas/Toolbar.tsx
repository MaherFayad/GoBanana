"use client";

/**
 * Top bar above the canvas (spec section 3): 36px on the shell background. Title and
 * "on {appName}", the zoom group, the save status (dot plus words), Upload and Share on the
 * web, and the shortcut sheet button. It sits outside the board, so it never covers a
 * focused item (SC 2.4.11). Insert tools live in the notch on the board (canvas/Notch.tsx).
 */
import type { Plan } from "@/lib/quota";
import { ShortcutKeys } from "@/components/studio/Kbd";
import { Tooltip } from "@/components/studio/Tooltip";
import type { SaveStatus } from "./autosave";
import { HelpIcon, SearchIcon, WarningIcon } from "./icons";
import { ShareButton } from "./ShareButton";
import { UploadButton } from "./UploadButton";
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
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "All changes saved",
  pending: "Unsaved changes",
  saving: "Saving…",
  saved: "All changes saved",
  error: "Could not save",
};

export function Toolbar(p: ToolbarProps) {
  return (
    <header className="bn-toolbar">
      <h1 className="bn-toolbar-title">
        <span className="bn-toolbar-title-text">{p.title}</span> <span className="bn-toolbar-app">on {p.appName}</span>
      </h1>

      {p.results && (
        <button
          type="button"
          className="st-btn"
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

      <ZoomMenu {...p.zoom} />

      <span className="bn-toolbar-sep" aria-hidden="true" />

      {p.readOnly ? (
        <span className="bn-status" data-status="view" data-testid="save-status">
          <span className="bn-status-dot" aria-hidden="true" />
          View only
        </span>
      ) : (
        <span className="bn-status" role="status" data-status={p.saveStatus} data-testid="save-status">
          {p.saveStatus === "error" ? <WarningIcon size={16} /> : <span className="bn-status-dot" aria-hidden="true" />}
          {STATUS_TEXT[p.saveStatus]}
          {p.saveStatus === "error" && (
            <button type="button" className="st-btn" data-variant="secondary" data-size="xs" onClick={p.onRetrySave}>
              Try again
            </button>
          )}
        </span>
      )}

      {!p.readOnly && p.canvasId && (
        <div className="bn-toolbar-group" role="group" aria-label="Upload and share">
          <UploadButton plan={p.plan} pricingHref={p.pricingHref} />
          <ShareButton canvasId={p.canvasId} initialToken={p.shareToken ?? null} plan={p.plan} pricingHref={p.pricingHref} />
        </div>
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
    </header>
  );
}
