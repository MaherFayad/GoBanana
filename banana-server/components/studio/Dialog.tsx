"use client";

import { useEffect, useId, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { CloseIcon } from "./icons";
import { Tooltip } from "./Tooltip";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl";
export type DialogTone = "default" | "danger";

export type DialogProps = {
  open: boolean;
  /** Called for Escape, the close button, a backdrop click, or a native close. Set open to false. */
  onClose: () => void;
  title: ReactNode;
  /** Small caps line above the title ("Delete account"). Red in the danger tone. */
  eyebrow?: ReactNode;
  /** "danger" uses role="alertdialog" and does not close on a backdrop click. */
  tone?: DialogTone;
  /** sm 360, md 440 (default), lg 520, xl 640, 2xl 820 px. */
  size?: DialogSize;
  /** Buttons, Cancel first (secondary), then the action. Rendered at the inline end. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Accessible name of the header close button. Default "Close". */
  closeLabel?: string;
  /** Element to focus on open. Default: first control in the body, else in the footer, else close. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Close on a click outside the panel. Default true, false for the danger tone. */
  closeOnBackdrop?: boolean;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

function firstFocusable(root: Element | null): HTMLElement | null {
  if (!root) return null;
  for (const el of root.querySelectorAll<HTMLElement>(FOCUSABLE)) {
    if (!el.closest("[hidden], [inert]")) return el;
  }
  return null;
}

/**
 * Dialog (spec 4.6) on the native <dialog> element with showModal(): the browser traps focus,
 * makes the page inert, puts the dialog in the top layer and handles Escape. Focus moves to the
 * first control (usually Cancel in a confirm) and returns to the opener on close.
 *
 * Controlled: render it always, flip `open`. Native alert(), confirm() and prompt() are banned.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  tone = "default",
  size = "md",
  footer,
  children,
  closeLabel = "Close",
  initialFocus,
  closeOnBackdrop,
  className,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const openRef = useRef(open);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const titleId = `st-dialog-title-${uid}`;
  const bodyId = `st-dialog-body-${uid}`;
  const backdropCloses = closeOnBackdrop ?? tone !== "danger";

  useEffect(() => {
    onCloseRef.current = onClose;
    openRef.current = open;
  });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const active = document.activeElement;
      returnTo.current = active instanceof HTMLElement && active !== document.body ? active : null;
      dialog.showModal();
      const target =
        initialFocus?.current ??
        firstFocusable(dialog.querySelector(".st-dialog-body")) ??
        firstFocusable(dialog.querySelector(".st-dialog-footer")) ??
        firstFocusable(dialog);
      target?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  // Native events: Escape (cancel) and any close (form method="dialog", close watcher).
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onCloseRef.current();
    };
    const onNativeClose = () => {
      const target = returnTo.current;
      returnTo.current = null;
      if (target && target.isConnected) target.focus();
      // Closed by the browser while the parent still thinks it is open: tell the parent.
      if (openRef.current) onCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onNativeClose);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onNativeClose);
    };
  }, []);

  // Unmounting while open still returns focus.
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) {
        const target = returnTo.current;
        dialog.close();
        if (target && target.isConnected) target.focus();
      }
    };
  }, []);

  const onClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (!backdropCloses || e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    // Keyboard "clicks" report 0,0; only real pointer clicks outside the panel close it.
    if (!inside && (e.clientX !== 0 || e.clientY !== 0)) onClose();
  };

  return (
    <dialog
      ref={ref}
      className={className ? `st-dialog ${className}` : "st-dialog"}
      data-size={size}
      data-tone={tone === "danger" ? "danger" : undefined}
      role={tone === "danger" ? "alertdialog" : undefined}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={tone === "danger" ? bodyId : undefined}
      onClick={onClick}
    >
      <header className="st-dialog-header">
        <div className="st-dialog-heading">
          {eyebrow && <p className="st-dialog-eyebrow">{eyebrow}</p>}
          <h2 className="st-dialog-title" id={titleId}>
            {title}
          </h2>
        </div>
        <Tooltip content={closeLabel} side="bottom">
          <button
            type="button"
            className="st-btn st-dialog-close"
            data-variant="ghost"
            data-size="sm"
            data-icon-only=""
            aria-label={closeLabel}
            onClick={onClose}
          >
            <CloseIcon size={16} />
          </button>
        </Tooltip>
      </header>
      <div className="st-dialog-body" id={bodyId}>
        {children}
      </div>
      {footer && <footer className="st-dialog-footer">{footer}</footer>}
    </dialog>
  );
}
