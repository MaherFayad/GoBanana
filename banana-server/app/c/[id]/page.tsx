/**
 * Full-screen web canvas: /c/:id (spec section 9). The same React Flow app as the
 * inline MCP Apps canvas, saving through /api/canvas/:id.
 *
 * Never indexed: canvases are private working files.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WebCanvas } from "@/canvas/WebCanvas";
import { loadCanvasForPage } from "@/canvas/server-stub";
import { APP_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Canvas | ${APP_NAME}`,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

type Props = { params: Promise<{ id: string }> };

export default async function CanvasPage({ params }: Props) {
  const { id } = await params;
  // TODO(db, lead): loadCanvasForPage is a stub; see canvas/server-stub.ts.
  const canvas = await loadCanvasForPage(id);
  if (!canvas) notFound();
  return (
    <WebCanvas
      canvasId={canvas.id}
      appName={APP_NAME}
      title={canvas.title}
      initialState={canvas.state}
      readOnly={canvas.readOnly}
    />
  );
}
