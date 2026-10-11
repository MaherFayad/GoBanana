"use client";

/**
 * Share button for the web canvas top bar (spec section 12: share links are Pro only;
 * hard rule 6: unlisted, view only, never indexed).
 *
 * Studio's share flow (docs/design-language.md section 10, "Share dialog"): a secondary sm
 * "Share" button opens a Dialog (md, 440px) with the view-only link, "Copy link" and
 * "Turn off link", or "Create view link" when there is none. Talks to `/api/canvas/:id/share`.
 * Results go to toasts ("Link copied"); a plan limit shows the plan note in the dialog.
 * The Dialog traps focus, closes on Escape and returns focus to this button.
 */
import { useId, useRef, useState } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { InfoIcon, ShareIcon } from "@/components/studio/icons";
import { pushToast } from "@/components/studio/Toast";
import { limitsFor, type Plan } from "@/lib/quota";
import { shareUrl } from "@/lib/share";
import "./overlays.css";

export interface ShareButtonProps {
  canvasId: string;
  /** Current `canvases.share_token`, if the canvas is already shared. */
  initialToken?: string | null;
  /**
   * The owner's effective plan (server side `effectivePlan()`, so BETA_PLAN counts). When it
   * has no share links, the dialog shows the plan note instead of "Create view link".
   * Unknown lets the server decide.
   */
  plan?: Plan | null;
  /** Where the plan note links. */
  pricingHref?: string;
}

type ShareResponse = { token?: string | null; url?: string | null; error?: string; upgradeUrl?: string };

const PLAN_NOTE = "View links are part of Pro. Anyone with the link can look at the canvas, but cannot change it.";

export function ShareButton({ canvasId, initialToken = null, plan, pricingHref = "/en/pricing" }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [serverUrl, setUrl] = useState<string | null>(null);
  // Until the server answers with a full link, build it from this page's origin.
  // (The dialog body only renders after a click, so `window` is there when it is used.)
  const url = serverUrl ?? (token && typeof window !== "undefined" ? shareUrl(window.location.origin, token) : null);
  const [busy, setBusy] = useState<"create" | "replace" | "off" | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(plan != null && !limitsFor(plan).shareLinks ? pricingHref : null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const inputId = `bn-share-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-link`;

  async function call(method: "POST" | "DELETE", kind: "create" | "replace" | "off") {
    setBusy(kind);
    try {
      const res = await fetch(`/api/canvas/${encodeURIComponent(canvasId)}/share`, {
        method,
        headers: { accept: "application/json" },
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as ShareResponse;
      if (!res.ok) {
        if (body.upgradeUrl) {
          setUpgradeUrl(body.upgradeUrl);
          return;
        }
        pushToast({ kind: "error", title: "Could not change the share link", body: body.error ?? "Try again." });
        return;
      }
      setToken(body.token ?? null);
      setUrl(body.url ?? null);
      // The button that was pressed may be gone now; keep focus inside the dialog.
      requestAnimationFrame(() => (body.token ? inputRef.current : createRef.current)?.focus());
      if (kind === "off") pushToast({ kind: "success", title: "Link turned off", body: "The old link no longer works." });
      else if (kind === "replace") pushToast({ kind: "success", title: "New link ready", body: "The old link no longer works." });
      else pushToast({ kind: "success", title: "Link ready" });
    } catch {
      pushToast({ kind: "error", title: "Could not reach the server", body: "Check your connection and try again." });
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      pushToast({ kind: "success", title: "Link copied" });
    } catch {
      // Clipboard blocked: select the text so the user can copy it themselves.
      inputRef.current?.focus();
      inputRef.current?.select();
      pushToast({ kind: "info", title: "Copy the selected link", body: "Press Control C, or Command C on a Mac." });
    }
  }

  const shared = Boolean(token && url);

  return (
    <div className="bn-share">
      <button
        type="button"
        className="st-btn"
        data-variant="secondary"
        data-size="sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <ShareIcon size={16} />
        <span>Share</span>
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Share canvas"
        size="md"
        className="bn-share-dialog"
        footer={
          shared ? (
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              data-size="sm"
              data-loading={busy === "replace" ? "inline" : undefined}
              aria-busy={busy === "replace" || undefined}
              disabled={busy !== null}
              onClick={() => void call("POST", "replace")}
            >
              {busy === "replace" ? "Making a new link…" : "Make a new link"}
            </button>
          ) : upgradeUrl ? null : (
            <button
              ref={createRef}
              type="button"
              className="st-btn"
              data-variant="primary"
              data-size="sm"
              data-loading={busy === "create" ? "inline" : undefined}
              aria-busy={busy === "create" || undefined}
              disabled={busy !== null}
              onClick={() => void call("POST", "create")}
            >
              {busy === "create" ? "Creating link…" : "Create view link"}
            </button>
          )
        }
      >
        <p className="bn-share-intro">
          Anyone with this link can view this canvas. They cannot change it. The link is not listed or shown in search
          engines.
        </p>
        {shared ? (
          <div className="bn-share-row">
            <div className="bn-share-row-main">
              <label htmlFor={inputId} className="bn-share-label">
                View-only link
              </label>
              <input
                ref={inputRef}
                id={inputId}
                className="bn-share-url"
                type="text"
                readOnly
                value={url ?? ""}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
            <div className="bn-share-row-actions">
              <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={() => void copy()}>
                Copy link
              </button>
              <button
                type="button"
                className="st-btn"
                data-variant="ghost"
                data-tone="danger"
                data-size="sm"
                data-loading={busy === "off" ? "inline" : undefined}
                aria-busy={busy === "off" || undefined}
                disabled={busy !== null}
                onClick={() => void call("DELETE", "off")}
              >
                {busy === "off" ? "Turning off…" : "Turn off link"}
              </button>
            </div>
          </div>
        ) : upgradeUrl ? (
          <div className="st-alert" data-tone="info">
            <span className="st-alert-icon">
              <InfoIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p>{PLAN_NOTE}</p>
              <p>
                <a href={upgradeUrl}>See plans</a>
              </p>
            </div>
          </div>
        ) : (
          <p className="bn-share-empty">This canvas has no view link yet.</p>
        )}
        {shared && <p className="bn-share-hint">Making a new link turns off the old one.</p>}
      </Dialog>
    </div>
  );
}
