"use client";

/**
 * Toolbar above the canvas. It sits outside the React Flow area, so it can never
 * cover a focused node (SC 2.4.11).
 */
import type { Plan } from "@/lib/quota";
import type { SaveStatus } from "./autosave";
import { IconFit, IconFrame, IconMinus, IconNote, IconPanel, IconPlus, IconWarning } from "./icons";
import { LAYOUT_LABELS, LAYOUTS, type LayoutKind } from "./layout-adapter";
import { UploadButton } from "./UploadButton";

export interface ToolbarProps {
  appName: string;
  title: string;
  readOnly: boolean;
  trayOpen: boolean;
  trayId: string;
  trayCount: number;
  saveStatus: SaveStatus;
  onToggleTray: () => void;
  onAddNote: () => void;
  onAddSection: () => void;
  onArrange: (layout: LayoutKind) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRetrySave: () => void;
  /**
   * Web canvas only (`/c/:id`): set it to show Upload and Share. Leave it unset inline
   * (MCP Apps), where the iframe has no web session to upload or share with.
   */
  canvasId?: string;
  /** Signed-in user's plan; free users see the controls with an upgrade note. */
  plan?: Plan | null;
  /** Current share token, if the canvas is shared. */
  shareToken?: string | null;
  /** Link for upgrade notes, for example "/en/pricing". */
  pricingHref?: string;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "All changes saved",
  pending: "Unsaved changes",
  saving: "Saving",
  saved: "All changes saved",
  error: "Could not save",
};

export function Toolbar(p: ToolbarProps) {
  return (
    <header className="bn-toolbar">
      <h1 className="bn-toolbar-title" title={p.title}>
        {p.title} <span className="bn-toolbar-app">on {p.appName}</span>
      </h1>

      {!p.readOnly && (
        <button
          type="button"
          className="bn-btn"
          aria-expanded={p.trayOpen}
          aria-controls={p.trayOpen ? p.trayId : undefined}
          onClick={p.onToggleTray}
        >
          <IconPanel />
          <span>{p.trayOpen ? "Hide results" : `Show results (${p.trayCount})`}</span>
        </button>
      )}

      {!p.readOnly && (
        <>
          <div className="bn-toolbar-group" role="group" aria-label="Add">
            <button type="button" className="bn-btn" onClick={p.onAddNote}>
              <IconNote />
              <span>Add note</span>
            </button>
            <button type="button" className="bn-btn" onClick={p.onAddSection}>
              <IconFrame />
              <span>Add section</span>
            </button>
          </div>

          {p.canvasId && <UploadButton plan={p.plan} pricingHref={p.pricingHref} />}

          <div className="bn-toolbar-group" role="group" aria-labelledby="bn-arrange-label">
            <span id="bn-arrange-label" className="bn-toolbar-label">
              Arrange:
            </span>
            {LAYOUTS.map((layout) => (
              <button key={layout} type="button" className="bn-btn" onClick={() => p.onArrange(layout)}>
                {LAYOUT_LABELS[layout]}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="bn-toolbar-group" role="group" aria-label="Zoom">
        <button type="button" className="bn-btn bn-btn-icon" onClick={p.onZoomOut} aria-label="Zoom out" title="Zoom out">
          <IconMinus />
        </button>
        <button type="button" className="bn-btn bn-btn-icon" onClick={p.onZoomIn} aria-label="Zoom in" title="Zoom in">
          <IconPlus />
        </button>
        <button type="button" className="bn-btn bn-btn-icon" onClick={p.onFit} aria-label="Fit everything in view" title="Fit in view">
          <IconFit />
        </button>
      </div>

      <span className="bn-toolbar-spacer" />

      {!p.readOnly && (
        <span className="bn-status" role="status" data-status={p.saveStatus} data-testid="save-status">
          {p.saveStatus === "error" && <IconWarning />}
          {STATUS_TEXT[p.saveStatus]}
          {p.saveStatus === "error" && (
            <button type="button" className="bn-btn" onClick={p.onRetrySave}>
              Try again
            </button>
          )}
        </span>
      )}
      {p.readOnly && <span className="bn-status">View only</span>}

      <details className="bn-help">
        <summary className="bn-btn">Keyboard help</summary>
        <div className="bn-help-panel">
          <dl>
            <dt>
              <kbd>Tab</kbd>
            </dt>
            <dd>Move between items and their controls</dd>
            <dt>
              <kbd>Arrows</kbd>
            </dt>
            <dd>Move the focused item 8 px</dd>
            <dt>
              <kbd>Shift</kbd> + <kbd>Arrows</kbd>
            </dt>
            <dd>Move it 32 px</dd>
            <dt>
              <kbd>+</kbd> <kbd>-</kbd>
            </dt>
            <dd>Make it bigger or smaller</dd>
            <dt>
              <kbd>M</kbd>
            </dt>
            <dd>Open the item menu (move to section, bring forward, remove)</dd>
            <dt>
              <kbd>F2</kbd>
            </dt>
            <dd>Edit a note, title or role</dd>
            <dt>
              <kbd>Delete</kbd>
            </dt>
            <dd>Remove the focused item</dd>
            <dt>
              <kbd>Enter</kbd>
            </dt>
            <dd>On a search result: add it to the canvas</dd>
          </dl>
        </div>
      </details>
    </header>
  );
}
