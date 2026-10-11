"use client";

/**
 * Takedown request form. Works without JavaScript (plain POST to /api/takedown,
 * which redirects back with ?status=). With JavaScript it validates with the same
 * zod schema, lists errors in a summary that takes focus, and ties each error to
 * its field with aria-describedby (SC 3.3.1, 3.3.2, 4.1.2).
 */
import { useRef, useState, type FormEvent } from "react";
import type { Dict } from "@/lib/site/dict";
import type { Locale } from "@/lib/site/i18n";
import {
  formDataToObject,
  parseTakedownForm,
  TAKEDOWN_FIELDS,
  TAKEDOWN_REASONS,
  TAKEDOWN_ROLES,
  type TakedownErrorCode,
  type TakedownField,
} from "@/lib/site/takedown-form";

type Errors = Partial<Record<TakedownField, TakedownErrorCode>>;
type Status = "idle" | "sending" | "sent" | "failed" | "invalid";

export function TakedownForm({ t, locale, initialStatus }: { t: Dict["takedown"]; locale: Locale; initialStatus: Status }) {
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<Status>(initialStatus);
  const summaryRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const errorIds = (field: TakedownField) => (errors[field] ? `${field}-error` : "");
  const describedBy = (field: TakedownField, hint: boolean) =>
    [hint ? `${field}-hint` : "", errorIds(field)].filter(Boolean).join(" ") || undefined;
  const invalid = (field: TakedownField) => (errors[field] ? true : undefined);

  function showErrors(next: Errors) {
    setErrors(next);
    setStatus("invalid");
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = formDataToObject(new FormData(event.currentTarget));
    const parsed = parseTakedownForm(values);
    if (!parsed.ok) return showErrors(parsed.errors);

    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/takedown", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 422) {
        const body = (await res.json()) as { errors?: Errors };
        return showErrors(body.errors ?? {});
      }
      if (!res.ok) throw new Error(String(res.status));
      setStatus("sent");
      formRef.current?.reset();
    } catch {
      setStatus("failed");
    }
  }

  const errorList = TAKEDOWN_FIELDS.filter((f) => errors[f]);
  const fieldLabel = (f: TakedownField) => t.fields[f].label;

  const err = (field: TakedownField) =>
    errors[field] ? (
      <span id={`${field}-error`} className="error">
        {t.errors[errors[field]!]}
      </span>
    ) : null;

  const req = <span className="note"> ({t.required})</span>;

  return (
    <>
      <div role="status">
        {status === "sent" ? <p className="status">{t.sent}</p> : null}
        {status === "failed" ? <p className="status bad">{t.failed}</p> : null}
        {status === "invalid" && errorList.length === 0 ? <p className="status bad">{t.invalid}</p> : null}
      </div>

      {errorList.length > 0 ? (
        <div ref={summaryRef} tabIndex={-1} className="error-summary" aria-labelledby="error-summary-title">
          <h3 id="error-summary-title" style={{ marginBlockStart: 0 }}>
            {t.errorSummary.replace("{n}", String(errorList.length))}
          </h3>
          <ul>
            {errorList.map((f) => (
              <li key={f}>
                <a href={`#${f === "reason" || f === "role" ? `${f}-0` : f}`}>
                  {fieldLabel(f)}: {t.errors[errors[f]!]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form ref={formRef} action="/api/takedown" method="post" noValidate onSubmit={onSubmit}>
        <input type="hidden" name="locale" value={locale} />

        <div className="field">
          <label htmlFor="name">
            {t.fields.name.label}
            {req}
          </label>
          <input id="name" name="name" type="text" autoComplete="name" required aria-invalid={invalid("name")} aria-describedby={describedBy("name", false)} />
          {err("name")}
        </div>

        <div className="field">
          <label htmlFor="email">
            {t.fields.email.label}
            {req}
          </label>
          <span id="email-hint" className="hint">
            {t.fields.email.hint}
          </span>
          <input
            id="email"
            name="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            aria-invalid={invalid("email")}
            aria-describedby={describedBy("email", true)}
          />
          {err("email")}
        </div>

        <div className="field">
          <label htmlFor="target">
            {t.fields.target.label}
            {req}
          </label>
          <span id="target-hint" className="hint">
            {t.fields.target.hint}
          </span>
          <input
            id="target"
            name="target"
            type="text"
            dir="ltr"
            inputMode="url"
            autoComplete="off"
            required
            aria-invalid={invalid("target")}
            aria-describedby={describedBy("target", true)}
          />
          {err("target")}
        </div>

        <fieldset aria-describedby={errorIds("reason") || undefined}>
          <legend>
            {t.fields.reason.label}
            {req}
          </legend>
          {TAKEDOWN_REASONS.map((r, i) => (
            <label key={r} className="choice" htmlFor={`reason-${i}`}>
              <input id={`reason-${i}`} type="radio" name="reason" value={r} required aria-describedby={errorIds("reason") || undefined} />
              {t.reasons[r]}
            </label>
          ))}
          {err("reason")}
        </fieldset>

        <fieldset aria-describedby={errorIds("role") || undefined}>
          <legend>
            {t.fields.role.label}
            {req}
          </legend>
          {TAKEDOWN_ROLES.map((r, i) => (
            <label key={r} className="choice" htmlFor={`role-${i}`}>
              <input id={`role-${i}`} type="radio" name="role" value={r} required aria-describedby={errorIds("role") || undefined} />
              {t.roles[r]}
            </label>
          ))}
          {err("role")}
        </fieldset>

        <div className="field">
          <label htmlFor="details">
            {t.fields.details.label}
            {req}
          </label>
          <span id="details-hint" className="hint">
            {t.fields.details.hint}
          </span>
          <textarea id="details" name="details" required aria-invalid={invalid("details")} aria-describedby={describedBy("details", true)} />
          {err("details")}
        </div>

        <div className="field">
          <label className="choice" htmlFor="confirm">
            <input id="confirm" name="confirm" type="checkbox" required aria-invalid={invalid("confirm")} aria-describedby={describedBy("confirm", false)} />
            {t.fields.confirm.label}
          </label>
          {err("confirm")}
        </div>

        <button type="submit" className="button" disabled={status === "sending"} aria-busy={status === "sending"}>
          {status === "sending" ? t.sending : t.submit}
        </button>
      </form>
    </>
  );
}
