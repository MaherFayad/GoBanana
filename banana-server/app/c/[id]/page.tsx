/**
 * Web canvas: /c/:id (spec section 9), as a window on the desk (canvas-view.tsx). Opened from a
 * site page, the same URL is intercepted and the window opens over that page instead. The same React Flow app as the
 * inline MCP Apps canvas, saving through /api/canvas/:id.
 *
 * Signed out: proxy.ts already sends the visitor to AuthKit; this page also redirects
 * to the sign-in route in case the proxy did not run. Not the owner: 404.
 * Never indexed: canvases are private working files.
 */
import type { Metadata } from "next";
import { APP_NAME } from "@/lib/config";
import { CanvasView } from "./canvas-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Canvas | ${APP_NAME}`,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

type Props = { params: Promise<{ id: string }> };

export default async function CanvasPage({ params }: Props) {
  const { id } = await params;
  return <CanvasView id={id} mode="page" dashboardHref="/en/canvases" />;
}
