"use client";

/**
 * Delete account through Studio's danger-tone dialog (components/studio/Dialog, role="alertdialog"):
 * eyebrow, title, a body that says what is deleted and what is kept, a required checkbox, then
 * Cancel (secondary, first, focused on open) and "Delete account" (destructive). The native
 * <dialog> traps focus, Escape closes it and focus returns to the opener.
 */
import { useId, useRef, useState, useTransition } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { CheckIcon, ErrorIcon } from "@/components/studio/icons";
import { deleteAccount } from "./actions";

export type DeleteLabels = {
  deleteButton: string;
  confirmEyebrow: string;
  confirmTitle: string;
  confirmDeleted: string;
  confirmKept: string;
  confirmCheck: string;
  confirmButton: string;
  cancel: string;
  close: string;
  deleting: string;
  deleteFailed: string;
  deleteDone: string;
};

export function DeleteAccount({ labels, afterDeleteHref }: { labels: DeleteLabels; afterDeleteHref: string }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const checkId = useId();

  function close() {
    if (pending) return;
    setOpen(false);
    setChecked(false);
  }

  function confirm() {
    if (!checked || pending) return;
    startTransition(async () => {
      const result = await deleteAccount().catch(() => ({ ok: false }));
      if (result.ok) {
        setMessage({ ok: true, text: labels.deleteDone });
        window.location.assign(afterDeleteHref);
      } else {
        setOpen(false);
        setChecked(false);
        setMessage({ ok: false, text: labels.deleteFailed });
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="st-btn"
        data-variant="destructive"
        data-size="lg"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
      >
        {labels.deleteButton}
      </button>
      <div role="status" className="delete-status">
        {message ? (
          <p className="st-alert" data-tone={message.ok ? "success" : "danger"}>
            <span className="st-alert-icon">{message.ok ? <CheckIcon size={16} /> : <ErrorIcon size={16} />}</span>
            <span className="st-alert-content">{message.text}</span>
          </p>
        ) : null}
      </div>

      <Dialog
        open={open}
        onClose={close}
        tone="danger"
        size="sm"
        {...{ eyebrow: labels.confirmEyebrow, title: labels.confirmTitle }}
        closeLabel={labels.close}
        initialFocus={cancelRef}
        footer={
          <>
            <button ref={cancelRef} type="button" className="st-btn" data-variant="secondary" data-size="lg" onClick={close}>
              {labels.cancel}
            </button>
            <button
              type="button"
              className="st-btn"
              data-variant="destructive"
              data-size="lg"
              data-loading={pending ? "inline" : undefined}
              aria-disabled={!checked && !pending ? true : undefined}
              aria-busy={pending || undefined}
              onClick={confirm}
            >
              {pending ? labels.deleting : labels.confirmButton}
            </button>
          </>
        }
      >
        <p>{labels.confirmDeleted}</p>
        <p>{labels.confirmKept}</p>
        <label className="choice top" htmlFor={checkId}>
          <input id={checkId} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          <span>{labels.confirmCheck}</span>
        </label>
      </Dialog>
    </>
  );
}
