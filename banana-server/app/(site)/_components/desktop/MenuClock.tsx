"use client";

/**
 * Menu bar clock. Rendered on the client only: the server snapshot is null, so the server HTML
 * and the first client render match (no hydration mismatch), and the time appears right after.
 * Arabic pages use Arabic-Indic digits. Decorative (aria-hidden): a ticking clock is noise for a
 * screen reader, and the page never depends on it.
 */
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/site/i18n";

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 10_000);
  return () => window.clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / 60_000);
const none = () => null;

export function MenuClock({ locale }: { locale: Locale }) {
  const minute = useSyncExternalStore(subscribe, minuteNow, none);
  if (minute === null) return <span className="menubar-clock" aria-hidden="true" />;
  const at = new Date(minute * 60_000);
  const tag = locale === "ar" ? "ar-u-nu-arab" : "en-US";
  const day = new Intl.DateTimeFormat(tag, { weekday: "short", month: "short", day: "numeric" }).format(at);
  const time = new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit" }).format(at);
  return (
    <span className="menubar-clock" aria-hidden="true">
      <span className="menubar-day">{day}</span>
      <span>{time}</span>
    </span>
  );
}
