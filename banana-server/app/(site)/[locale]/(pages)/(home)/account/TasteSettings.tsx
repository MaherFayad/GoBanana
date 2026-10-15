"use client";

/**
 * Taste profile controls for the account window (P2-02, VAL-03): the style words with a Clear
 * button, and "import from your own images". Images go through the normal upload route (Pro plan,
 * size rules and quota apply); the server action then keeps style words only.
 */
import { useRef, useState, useTransition } from "react";
import { CheckIcon, ErrorIcon } from "@/components/studio/icons";
import { MAX_IMPORT_IMAGES, MIN_IMPORT_IMAGES } from "@/lib/taste-profile/import-limits";
import { UPLOAD_ACCEPT, UPLOAD_FIELD } from "@/lib/uploads/rules";
import { clearTaste, importTaste } from "./actions";

export type TasteLabels = {
  wordsLabel: string;
  empty: string;
  clear: string;
  clearing: string;
  cleared: string;
  clearFailed: string;
  importLabel: string;
  importNote: string;
  importButton: string;
  importing: string;
  imported: string;
  importFailed: string;
  importCount: string;
  pinterest: string;
  pinterestNote: string;
};

type Message = { ok: boolean; text: string };

export function TasteSettings({
  words: initialWords,
  labels,
  pinterestHref,
}: {
  words: string[];
  labels: TasteLabels;
  /** Set only while the Pinterest import flag is on. */
  pinterestHref?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [words, setWords] = useState(initialWords);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function clear() {
    setMessage(null);
    startTransition(async () => {
      const result = await clearTaste().catch(() => ({ ok: false }));
      if (result.ok) setWords([]);
      setMessage({ ok: result.ok, text: result.ok ? labels.cleared : labels.clearFailed });
    });
  }

  async function onFiles(files: FileList | null) {
    const list = files ? [...files] : [];
    if (list.length < MIN_IMPORT_IMAGES || list.length > MAX_IMPORT_IMAGES) {
      setMessage({ ok: false, text: labels.importCount });
      return;
    }
    setMessage(null);
    setBusy(true);
    try {
      const ids: string[] = [];
      for (const file of list) {
        const body = new FormData();
        body.set(UPLOAD_FIELD, file);
        const res = await fetch("/api/uploads", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
        if (!res.ok || !json.id) {
          setMessage({ ok: false, text: json.message ?? labels.importFailed });
          return;
        }
        ids.push(json.id);
      }
      const result = await importTaste(ids).catch(() => ({ ok: false, error: undefined }));
      setMessage({ ok: result.ok, text: result.ok ? labels.imported : (result.error ?? labels.importFailed) });
      // The new words show after the next load of this window.
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <div className="settings-row">
        <span className="settings-row-label">{labels.wordsLabel}</span>
        <span className="settings-row-end">
          <span className="settings-row-value">{words.length > 0 ? words.join(", ") : labels.empty}</span>
          {words.length > 0 ? (
            <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={clear} aria-busy={pending || undefined}>
              {pending ? labels.clearing : labels.clear}
            </button>
          ) : null}
        </span>
      </div>
      <div className="settings-row">
        <span className="settings-row-label">
          {labels.importLabel}
          <span className="settings-row-note">{labels.importNote}</span>
        </span>
        <span className="settings-row-end">
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            hidden
            onChange={(e) => void onFiles(e.target.files)}
          />
          <button
            type="button"
            className="st-btn"
            data-variant="secondary"
            data-size="sm"
            aria-busy={busy || undefined}
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? labels.importing : labels.importButton}
          </button>
        </span>
      </div>
      {pinterestHref ? (
        <div className="settings-row">
          <span className="settings-row-label">
            {labels.pinterest}
            <span className="settings-row-note">{labels.pinterestNote}</span>
          </span>
          <a className="st-btn" data-variant="secondary" data-size="sm" href={pinterestHref}>
            {labels.pinterest}
          </a>
        </div>
      ) : null}
      <div role="status" className="delete-status">
        {message ? (
          <p className="st-alert" data-tone={message.ok ? "success" : "danger"}>
            <span className="st-alert-icon">{message.ok ? <CheckIcon size={16} /> : <ErrorIcon size={16} />}</span>
            <span className="st-alert-content">{message.text}</span>
          </p>
        ) : null}
      </div>
    </>
  );
}
