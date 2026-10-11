/**
 * Full-screen web canvas: /c/:id (spec section 9). The same React Flow app as the
 * inline MCP Apps canvas, saving through /api/canvas/:id.
 *
 * Signed out: proxy.ts already sends the visitor to AuthKit; this page also redirects
 * to the sign-in route in case the proxy did not run. Not the owner: 404.
 * Never indexed: canvases are private working files.
 */
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WebCanvas } from "@/canvas/WebCanvas";
import { loadCanvasForPage } from "@/canvas/server-load";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { e2eAuthBypass, signInHref } from "@/lib/web-auth";
import { getWebUser } from "@/lib/web-session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Canvas | ${APP_NAME}`,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

type Props = { params: Promise<{ id: string }> };

export default async function CanvasPage({ params }: Props) {
  const { id } = await params;
  const result = await loadCanvasForPage(id, { getUser: getWebUser, repos: getRepos, bypass: e2eAuthBypass() });
  if (result.kind === "signed_out") redirect(signInHref(`/c/${encodeURIComponent(id)}`));
  if (result.kind === "not_found") notFound();
  const { canvas } = result;
  return (
    <WebCanvas
      canvasId={canvas.id}
      appName={APP_NAME}
      title={canvas.title}
      initialState={canvas.state}
      initialUpdatedAt={canvas.updatedAt}
      readOnly={canvas.readOnly}
      plan={canvas.plan}
      shareToken={canvas.shareToken}
    />
  );
}
