"use client";

/**
 * Client review on the share page (VAL-04): a "Review" button over the board opens a side panel
 * where anyone with the link can keep or drop each direction and leave a short plain text comment.
 * No sign in. Answers go to POST /api/review/:token (limits and checks live there).
 *
 * - Keyboard: every control is a native button, field or link in reading order. The toggle has
 *   aria-expanded and aria-controls; opening moves focus to the panel heading, Escape or Close
 *   closes it and returns focus to the toggle. The board stays usable while the panel is open.
 * - Keep and Drop are toggle buttons (aria-pressed): pressing the active one clears the vote.
 *   Results are announced in one polite status region.
 * - The reviewer is a random id kept in this browser (localStorage, wrapped in try/catch); it is
 *   not an account. The comment is plain text: it is sent and shown as text, never as HTML.
 * - The panel sets its own `lang` and `dir`, so Arabic reads right to left while the page chrome
 *   stays as it is.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CloseIcon } from "@/components/studio/icons";
import { MAX_COMMENT, MAX_NAME, type ReviewDirection, type ReviewVerdict } from "@/lib/review";
import type { ReviewCopy, ReviewLocale } from "@/lib/review/copy";
import { fmt } from "@/lib/site/i18n";

type Vote = { verdict: ReviewVerdict | null; saved: string; draft: string };
type Status = { text: string; error: boolean };

const KEY_STORE = "gb-reviewer";
const NAME_STORE = "gb-reviewer-name";

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the review still works for this visit.
  }
}

function newReviewerKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ReviewPanelProps {
  token: string;
  directions: ReviewDirection[];
  copy: ReviewCopy;
  locale: ReviewLocale;
  /** Link that shows this page in the other language. */
  switchHref: string;
}

export function ReviewPanel({ token, directions, copy, locale, switchHref }: ReviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Status>({ text: "", error: false });
  const reviewer = useRef<string>("");
  const toggle = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const panelId = useId();
  const headingId = useId();
  const dir = locale === "ar" ? "rtl" : "ltr";

  // The reviewer id and name live in this browser; earlier votes come back from the server.
  useEffect(() => {
    let key = readStore(KEY_STORE);
    if (!key || !/^[A-Za-z0-9_-]{16,64}$/.test(key)) {
      key = newReviewerKey();
      writeStore(KEY_STORE, key);
    }
    reviewer.current = key;
    const stored = readStore(NAME_STORE) ?? "";
    let live = true;
    queueMicrotask(() => {
      if (live) setName(stored);
    });
    fetch(`/api/review/${encodeURIComponent(token)}?reviewer=${encodeURIComponent(key)}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ votes?: { directionKey: string; verdict: ReviewVerdict | null; comment: string | null }[] }>) : null))
      .then((body) => {
        if (!live || !body?.votes) return;
        setVotes(Object.fromEntries(body.votes.map((v) => [v.directionKey, { verdict: v.verdict, saved: v.comment ?? "", draft: v.comment ?? "" }])));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [token]);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    toggle.current?.focus();
  }, []);

  const send = useCallback(
    async (directionKey: string, verdict: ReviewVerdict | null, comment: string) => {
      setStatus({ text: "", error: false });
      try {
        const res = await fetch(`/api/review/${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reviewerKey: reviewer.current, directionKey, verdict, comment, name: name.trim() }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; cleared?: boolean };
        if (!res.ok) {
          setStatus({ text: body.error === "rate_limited" ? copy.rateLimited : body.error === "full" ? copy.full : copy.failed, error: true });
          return false;
        }
        setVotes((v) => ({ ...v, [directionKey]: { verdict, saved: comment, draft: comment } }));
        setStatus({ text: body.cleared ? copy.cleared : copy.saved, error: false });
        return true;
      } catch {
        setStatus({ text: copy.failed, error: true });
        return false;
      }
    },
    [token, name, copy],
  );

  const setVerdict = (key: string, pressed: ReviewVerdict) => {
    const now = votes[key];
    const next = now?.verdict === pressed ? null : pressed;
    void send(key, next, now?.saved ?? "");
  };

  return (
    <>
      <button
        ref={toggle}
        type="button"
        className="st-btn rv-toggle"
        data-variant="primary"
        data-size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        lang={locale}
        dir={dir}
        onClick={() => (open ? close() : setOpen(true))}
      >
        {copy.toggle}
      </button>
      <aside
        id={panelId}
        className="rv-panel"
        aria-labelledby={headingId}
        hidden={!open}
        lang={locale}
        dir={dir}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <div className="rv-head">
          <h2 id={headingId} ref={heading} tabIndex={-1}>
            {copy.heading}
          </h2>
          <a className="st-btn" data-variant="ghost" data-size="xs" href={switchHref} lang={locale === "ar" ? "en" : "ar"} aria-label={copy.langSwitchLabel}>
            {copy.langSwitch}
          </a>
          <button type="button" className="st-btn" data-variant="ghost" data-size="xs" data-icon-only="" aria-label={copy.close} onClick={close}>
            <CloseIcon size={16} />
          </button>
        </div>
        <p className="rv-intro">{copy.intro}</p>
        <label className="rv-field">
          <span>{copy.nameLabel}</span>
          <input
            className="st-input"
            type="text"
            value={name}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => writeStore(NAME_STORE, name.trim())}
          />
        </label>
        <p className="rv-status" role="status" data-error={status.error ? "" : undefined}>
          {status.text}
        </p>
        {directions.length === 0 ? (
          <p className="rv-empty">{copy.empty}</p>
        ) : (
          <ol className="rv-list">
            {directions.map((d) => {
              const v = votes[d.key] ?? { verdict: null, saved: "", draft: "" };
              const titleId = `${panelId}-t-${d.key}`;
              const commentId = `${panelId}-c-${d.key}`;
              const hintId = `${panelId}-h-${d.key}`;
              return (
                <li key={d.key} className="rv-item" aria-labelledby={titleId}>
                  <h3 id={titleId}>
                    <bdi>{d.title}</bdi>
                  </h3>
                  <div className="rv-verdicts" role="group" aria-label={fmt(copy.verdictGroup, { title: d.title })}>
                    <button type="button" className="st-btn" data-size="sm" data-variant="secondary" aria-pressed={v.verdict === "keep"} onClick={() => setVerdict(d.key, "keep")}>
                      {v.verdict === "keep" ? copy.kept : copy.keep}
                    </button>
                    <button type="button" className="st-btn" data-size="sm" data-variant="secondary" data-tone="danger" aria-pressed={v.verdict === "drop"} onClick={() => setVerdict(d.key, "drop")}>
                      {v.verdict === "drop" ? copy.dropped : copy.drop}
                    </button>
                  </div>
                  <label className="rv-field" htmlFor={commentId}>
                    <span>{fmt(copy.commentLabel, { title: d.title })}</span>
                  </label>
                  <textarea
                    id={commentId}
                    className="st-input"
                    rows={3}
                    value={v.draft}
                    maxLength={MAX_COMMENT}
                    aria-describedby={hintId}
                    onChange={(e) => setVotes((all) => ({ ...all, [d.key]: { ...v, draft: e.target.value } }))}
                  />
                  <p id={hintId} className="rv-hint">
                    {fmt(copy.commentHint, { n: [...v.draft].length, max: MAX_COMMENT })}
                  </p>
                  <button
                    type="button"
                    className="st-btn"
                    data-size="sm"
                    data-variant="secondary"
                    disabled={v.draft.trim() === v.saved.trim()}
                    onClick={() => void send(d.key, v.verdict, v.draft)}
                  >
                    {copy.save}
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </>
  );
}
