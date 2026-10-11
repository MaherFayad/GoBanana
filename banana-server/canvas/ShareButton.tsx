"use client";

/**
 * Share button for the web canvas toolbar (spec section 12: share links are Pro only;
 * hard rule 6: unlisted, view only, never indexed).
 *
 * Opens a small panel with the view-only link and a copy button. The link can be replaced
 * (the old one stops working) or turned off. Talks to `/api/canvas/:id/share`.
 * Keyboard: the panel is a disclosure; Escape closes it and returns focus to the button.
 */
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { shareUrl } from "@/lib/share";

export interface ShareButtonProps {
  canvasId: string;
  /** Current `canvases.share_token`, if the canvas is already shared. */
  initialToken?: string | null;
}

type ShareResponse = { token?: string | null; url?: string | null; error?: string; upgradeUrl?: string };

export function ShareButton({ canvasId, initialToken = null }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(initialToken);
  const [serverUrl, setUrl] = useState<string | null>(null);
  // Until the server answers with a full link, build it from this page's origin.
  // (The panel only renders after a click, so `window` is always there when it is used.)
  const url = serverUrl ?? (token && typeof window !== "undefined" ? shareUrl(window.location.origin, token) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; upgradeUrl?: string } | null>(null);
  const [status, setStatus] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);
  const panelId = `bn-share-${useId().replace(/:/g, "")}`;
  const inputId = `${panelId}-link`;


  async function call(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    setStatus("");
    try {
      const res = await fetch(`/api/canvas/${encodeURIComponent(canvasId)}/share`, {
        method,
        headers: { accept: "application/json" },
        credentials: "same-origin",
      });
      const body = (await res.json().catch(() => ({}))) as ShareResponse;
      if (!res.ok) {
        setError({
          message: body.error ?? "Could not change the share link. Try again.",
          ...(body.upgradeUrl ? { upgradeUrl: body.upgradeUrl } : {}),
        });
        return;
      }
      setToken(body.token ?? null);
      setUrl(body.url ?? null);
      // The button that was pressed may be gone now; keep focus inside the panel.
      requestAnimationFrame(() => (body.token ? inputRef.current : createRef.current)?.focus());
      setStatus(method === "DELETE" ? "Link turned off. The old link no longer works." : "Link ready.");
    } catch {
      setError({ message: "Could not reach the server. Try again." });
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      // Clipboard blocked: select the text so the user can copy it themselves.
      inputRef.current?.select();
      setStatus("Press Control C or Command C to copy the selected link.");
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    }
  }

  return (
    <div className="bn-share" onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="bn-btn"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {token ? "Shared" : "Share"}
      </button>
      {open && (
        <div id={panelId} className="bn-share-panel" role="group" aria-label="Share link">
          <p className="bn-share-note">
            Anyone with the link can view this canvas. They cannot change it. The link is not listed or shown in search
            engines.
          </p>
          {token && url ? (
            <>
              <label htmlFor={inputId} className="bn-share-label">
                View-only link
              </label>
              <div className="bn-share-row">
                <input
                  ref={inputRef}
                  id={inputId}
                  className="bn-share-input"
                  type="text"
                  readOnly
                  value={url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button type="button" className="bn-btn bn-btn-primary" onClick={() => void copy()}>
                  Copy link
                </button>
              </div>
              <div className="bn-share-row">
                <button type="button" className="bn-btn" disabled={busy} onClick={() => void call("POST")}>
                  Make a new link
                </button>
                <button type="button" className="bn-btn" disabled={busy} onClick={() => void call("DELETE")}>
                  Turn off link
                </button>
              </div>
            </>
          ) : (
            <button
              ref={createRef}
              type="button"
              className="bn-btn bn-btn-primary"
              disabled={busy}
              onClick={() => void call("POST")}
            >
              Create view-only link
            </button>
          )}
          {error && (
            <p className="bn-share-error" role="alert">
              {error.message}{" "}
              {error.upgradeUrl && (
                <a href={error.upgradeUrl} target="_blank" rel="noopener">
                  See plans
                </a>
              )}
            </p>
          )}
          {/* Always rendered, so screen readers hear each change. */}
          <p className="bn-share-status" role="status">
            {busy ? "Working" : status}
          </p>
        </div>
      )}
    </div>
  );
}
