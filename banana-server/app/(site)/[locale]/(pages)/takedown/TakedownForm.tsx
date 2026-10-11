"use client";

/**
 * Takedown request form. Works without JavaScript (plain POST to /api/takedown,
 * which redirects back with ?status=). With JavaScript it validates with the same
 * zod schema, lists errors in a summary that takes focus, and ties each error to
 * its field with aria-describedby (SC 3.3.1, 3.3.2, 4.1.2). Studio look: 44px .st-input fields,
 * label above, hint below the label, inline errors with an icon and role="alert", the summary and
 * the result as .st-alert, 24px radios and checkbox.
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
import { CheckIcon, ErrorIcon } from "@/components/studio/icons";
import { bidi } from "../../../_components/Bidi";

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
    if (status === "sending") return;
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
  const sending = status === "sending";

  // Inline error under its field: icon plus words, role="alert", tied to the field by aria-describedby.
  const err = (field: TakedownField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="field-error" role="alert">
        <ErrorIcon size={16} />
        <span>
          <span className="st-visually-hidden">{t.errorPrefix} </span>
          {bidi(t.errors[errors[field]!])}
        </span>
      </p>
    ) : null;

  const req = <span className="required"> ({t.required})</span>;

  const alert = (tone: "success" | "danger", title: string | null, body: string) => (
    <div className="st-alert alert-gap" data-tone={tone}>
      <span className="st-alert-icon">{tone === "success" ? <CheckIcon size={16} /> : <ErrorIcon size={16} />}</span>
      <div className="st-alert-content">
        {title ? <p className="st-alert-title">{title}</p> : null}
        <p>{body}</p>
      </div>
    </div>
  );

  return (
    <>
      <div role="status">
        {status === "sent" ? alert("success", t.sentTitle, t.sent) : null}
        {status === "failed" ? alert("danger", t.failedTitle, t.failed) : null}
        {status === "invalid" && errorList.length === 0 ? alert("danger", null, t.invalid) : null}
      </div>

      {errorList.length > 0 ? (
        <div
          ref={summaryRef}
          tabIndex={-1}
          className="st-alert alert-gap error-summary"
          data-tone="danger"
          aria-labelledby="error-summary-title"
          role="group"
        >
          <span className="st-alert-icon">
            <ErrorIcon size={16} />
          </span>
          <div className="st-alert-content">
            <h3 id="error-summary-title" className="st-alert-title">
              {t.errorSummary.replace("{n}", String(errorList.length))}
            </h3>
            <ul>
              {errorList.map((f) => (
                <li key={f}>
                  <a href={`#${f === "reason" || f === "role" ? `${f}-0` : f}`}>
                    {fieldLabel(f)}: {bidi(t.errors[errors[f]!])}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <form ref={formRef} className="form" action="/api/takedown" method="post" noValidate onSubmit={onSubmit}>
        <input type="hidden" name="locale" value={locale} />

        <div className="field">
          <label htmlFor="name">
            {t.fields.name.label}
            {req}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="st-input"
            data-size="lg"
            autoComplete="name"
            required
            aria-invalid={invalid("name")}
            aria-describedby={describedBy("name", false)}
          />
          {err("name")}
        </div>

        <div className="field">
          <label htmlFor="email">
            {t.fields.email.label}
            {req}
          </label>
          <p id="email-hint" className="hint">
            {bidi(t.fields.email.hint)}
          </p>
          <input
            id="email"
            name="email"
            type="email"
            className="st-input"
            data-size="lg"
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
          <p id="target-hint" className="hint">
            {bidi(t.fields.target.hint)}
          </p>
          <input
            id="target"
            name="target"
            type="text"
            className="st-input"
            data-size="lg"
            dir="ltr"
            inputMode="url"
            autoComplete="off"
            required
            aria-invalid={invalid("target")}
            aria-describedby={describedBy("target", true)}
          />
          {err("target")}
        </div>

        <fieldset className="field" aria-describedby={errorIds("reason") || undefined}>
          <legend>
            {t.fields.reason.label}
            {req}
          </legend>
          {TAKEDOWN_REASONS.map((r, i) => (
            <label key={r} className="choice" htmlFor={`reason-${i}`}>
              <input
                id={`reason-${i}`}
                type="radio"
                name="reason"
                value={r}
                required
                aria-describedby={errorIds("reason") || undefined}
              />
              <span>{t.reasons[r]}</span>
            </label>
          ))}
          {err("reason")}
        </fieldset>

        <fieldset className="field" aria-describedby={errorIds("role") || undefined}>
          <legend>
            {t.fields.role.label}
            {req}
          </legend>
          {TAKEDOWN_ROLES.map((r, i) => (
            <label key={r} className="choice" htmlFor={`role-${i}`}>
              <input
                id={`role-${i}`}
                type="radio"
                name="role"
                value={r}
                required
                aria-describedby={errorIds("role") || undefined}
              />
              <span>{t.roles[r]}</span>
            </label>
          ))}
          {err("role")}
        </fieldset>

        <div className="field">
          <label htmlFor="details">
            {t.fields.details.label}
            {req}
          </label>
          <p id="details-hint" className="hint">
            {bidi(t.fields.details.hint)}
          </p>
          <textarea
            id="details"
            name="details"
            className="st-input"
            data-size="lg"
            rows={6}
            required
            aria-invalid={invalid("details")}
            aria-describedby={describedBy("details", true)}
          />
          {err("details")}
        </div>

        <div className="field">
          <label className="choice top" htmlFor="confirm">
            <input
              id="confirm"
              name="confirm"
              type="checkbox"
              required
              aria-invalid={invalid("confirm")}
              aria-describedby={describedBy("confirm", false)}
            />
            <span>{t.fields.confirm.label}</span>
          </label>
          {err("confirm")}
        </div>

        <button
          type="submit"
          className="st-btn"
          data-variant="primary"
          data-size="lg"
          data-loading={sending ? "inline" : undefined}
          aria-busy={sending || undefined}
        >
          {sending ? t.sending : t.submit}
        </button>
      </form>
    </>
  );
}
