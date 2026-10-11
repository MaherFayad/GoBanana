"use client";

/**
 * Delete account with a confirm step. Uses the native <dialog> (focus moves in,
 * Escape closes, focus returns to the opener) and a required checkbox.
 */
import { useId, useRef, useState, useTransition } from "react";
import { deleteAccount } from "./actions";

export type DeleteLabels = {
  deleteButton: string;
  confirmTitle: string;
  confirmBody: string;
  confirmCheck: string;
  confirmButton: string;
  cancel: string;
  deleting: string;
  deleteFailed: string;
  deleteDone: string;
};

export function DeleteAccount({ labels, afterDeleteHref }: { labels: DeleteLabels; afterDeleteHref: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();
  const bodyId = useId();
  const checkId = useId();

  function close() {
    dialogRef.current?.close();
    setChecked(false);
    openerRef.current?.focus();
  }

  function confirm() {
    startTransition(async () => {
      const result = await deleteAccount().catch(() => ({ ok: false }));
      if (result.ok) {
        setMessage({ ok: true, text: labels.deleteDone });
        window.location.assign(afterDeleteHref);
      } else {
        close();
        setMessage({ ok: false, text: labels.deleteFailed });
      }
    });
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        className="button danger"
        onClick={() => {
          setMessage(null);
          dialogRef.current?.showModal();
        }}
      >
        {labels.deleteButton}
      </button>
      <div role="status">{message ? <p className={`status${message.ok ? "" : " bad"}`}>{message.text}</p> : null}</div>

      <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={bodyId} onClose={() => setChecked(false)}>
        <h2 id={titleId} style={{ marginBlockStart: 0 }}>
          {labels.confirmTitle}
        </h2>
        <p id={bodyId}>{labels.confirmBody}</p>
        <label className="choice" htmlFor={checkId}>
          <input id={checkId} type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          {labels.confirmCheck}
        </label>
        <div className="actions">
          <button type="button" className="button danger" disabled={!checked || pending} onClick={confirm} aria-busy={pending}>
            {pending ? labels.deleting : labels.confirmButton}
          </button>
          <button type="button" className="button secondary" onClick={close} autoFocus>
            {labels.cancel}
          </button>
        </div>
      </dialog>
    </>
  );
}
