"use client";

/**
 * "Delete canvas" for the web canvas top bar (owner only: the Toolbar shows it only on the web
 * canvas when it is not read only, so never in the shared view or the inline app in chat).
 *
 * Same flow as the dashboard (app/(site)/[locale]/canvases/Dashboard.tsx): a danger-tone confirm
 * (role="alertdialog") that names the canvas, Cancel first and focused, Escape closes. Delete
 * calls DELETE /api/canvas/:id; on success (or 404, already gone) the page goes to the
 * dashboard, on failure the dialog stays open with the reason in an alert.
 *
 * Copy matches the dashboard's English labels in lib/site/dict (the canvas UI is English only;
 * importing the site dictionary would add it to the canvas bundle).
 */
import { useRef, useState } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { ErrorIcon, TrashIcon } from "@/components/studio/icons";
import { Tooltip } from "@/components/studio/Tooltip";

export const DELETE_LABELS = {
  deleteCanvas: "Delete canvas",
  deleteTitle: "Delete {title}?",
  deleteBody: "This deletes the canvas for good: its sections, items, tray, directions and view link. It cannot be undone.",
  deleteUploads: "Images you uploaded to it are deleted too, unless another canvas of yours shows them.",
  deleteCancel: "Cancel",
  deleting: "Deleting…",
  deleteFailed: "Could not delete this canvas. Try again in a minute.",
  close: "Close",
} as const;

export interface DeleteCanvasButtonProps {
  canvasId: string;
  title: string;
  /** Where to go after the canvas is gone (the canvases dashboard). */
  dashboardHref: string;
  /** For tests: replaces the page navigation. */
  navigate?: (href: string) => void;
}

/** DELETE the canvas. Resolves to null when it is gone (404 counts), else the plain error to show. */
export async function requestCanvasDelete(canvasId: string, fetcher: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetcher(`/api/canvas/${encodeURIComponent(canvasId)}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
      credentials: "same-origin",
    });
    if (res.ok || res.status === 404) return null;
    const body = (await res.json().catch(() => ({}))) as { error?: unknown };
    return typeof body.error === "string" && body.error ? body.error : DELETE_LABELS.deleteFailed;
  } catch {
    return DELETE_LABELS.deleteFailed;
  }
}

export function DeleteCanvasButton({ canvasId, title, dashboardHref, navigate }: DeleteCanvasButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [before = "", after = ""] = DELETE_LABELS.deleteTitle.split("{title}");

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const failed = await requestCanvasDelete(canvasId);
    if (failed === null) {
      (navigate ?? ((href: string) => window.location.assign(href)))(dashboardHref);
      return;
    }
    setBusy(false);
    setError(failed);
  };

  return (
    <>
      <Tooltip content={DELETE_LABELS.deleteCanvas}>
        <button
          type="button"
          className="st-btn"
          data-variant="ghost"
          data-icon-only=""
          aria-label={DELETE_LABELS.deleteCanvas}
          aria-haspopup="dialog"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          <TrashIcon size={16} />
        </button>
      </Tooltip>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        tone="danger"
        size="sm"
        eyebrow={DELETE_LABELS.deleteCanvas}
        title={
          <>
            {before}
            <bdi>{title}</bdi>
            {after}
          </>
        }
        closeLabel={DELETE_LABELS.close}
        initialFocus={cancelRef}
        footer={
          <>
            <button
              ref={cancelRef}
              type="button"
              className="st-btn"
              data-variant="secondary"
              data-size="lg"
              aria-disabled={busy || undefined}
              onClick={() => !busy && setOpen(false)}
            >
              {DELETE_LABELS.deleteCancel}
            </button>
            <button
              type="button"
              className="st-btn"
              data-variant="destructive"
              data-size="lg"
              // aria-disabled, not disabled, so focus stays on the button while it works.
              aria-busy={busy || undefined}
              aria-disabled={busy || undefined}
              onClick={() => !busy && void confirm()}
            >
              {busy ? DELETE_LABELS.deleting : DELETE_LABELS.deleteCanvas}
            </button>
          </>
        }
      >
        <p>{DELETE_LABELS.deleteBody}</p>
        <p>{DELETE_LABELS.deleteUploads}</p>
        <div role="status">
          {error && (
            <p className="st-alert" data-tone="danger">
              <span className="st-alert-icon">
                <ErrorIcon size={16} />
              </span>
              <span className="st-alert-content">{error}</span>
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
