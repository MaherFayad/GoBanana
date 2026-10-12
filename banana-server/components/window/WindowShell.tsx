"use client";

/**
 * The window a route opens at once, while the server loads its content (the route's loading.tsx):
 * the same WindowLayer as the real window, marked as a shell, so the window grows out of the link
 * or card right away and the real one takes over without a second open. The label follows the
 * page's locale.
 */
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { WindowLayer } from "./WindowLayer";

type Props = {
  kind: "canvas" | "finder";
  labels: { en: string; ar: string };
  /** Where close goes if there is no history to go back to. */
  closeTo: "home" | "canvases";
  portal?: boolean;
  children: ReactNode;
};

export function WindowShell({ kind, labels, closeTo, portal, children }: Props) {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale === "ar" ? "ar" : "en";
  return (
    <WindowLayer mode="overlay" kind={kind} label={labels[locale]} closeHref={closeTo === "home" ? `/${locale}` : `/${locale}/canvases`} portal={portal} escapeCloses shell>
      <div className="wl-shell" role="status" aria-busy="true">
        {children}
      </div>
    </WindowLayer>
  );
}
