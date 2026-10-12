/**
 * The web canvas as a window (components/window/WindowLayer): shared by the direct route
 * (app/c/[id]/page.tsx, the window on the desk) and the intercepted one
 * (app/(site)/[locale]/@modal/(...)c/[id]/page.tsx, the window over the site page that opened it).
 *
 * Signed out goes to sign-in and back here; not the owner: 404.
 */
import { notFound, redirect } from "next/navigation";
import { WebCanvas } from "@/canvas/WebCanvas";
import { loadCanvasForPage } from "@/canvas/server-load";
import { WindowLayer } from "@/components/window/WindowLayer";
import { APP_NAME } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { e2eAuthBypass, signInHref } from "@/lib/web-auth";
import { getWebUser } from "@/lib/web-session";

/** The dashboard card a canvas window grows out of (Dashboard.tsx sets the attribute). */
export const canvasOrigin = (id: string) => `[data-window-origin="canvas:${quoteAttr(id)}"]`;

/** Canvas ids are url-safe tokens; quote marks and backslashes are escaped for the selector anyway. */
function quoteAttr(v: string): string {
  return v.replace(/["\\]/g, "\\$&");
}

export async function CanvasView({ id, mode, dashboardHref }: { id: string; mode: "overlay" | "page"; dashboardHref: string }) {
  const result = await loadCanvasForPage(id, { getUser: getWebUser, repos: getRepos, bypass: e2eAuthBypass() });
  if (result.kind === "signed_out") redirect(signInHref(`/c/${encodeURIComponent(id)}`));
  if (result.kind === "not_found") notFound();
  const { canvas } = result;
  return (
    <WindowLayer
      mode={mode}
      kind="canvas"
      label={`${canvas.title} | ${APP_NAME}`}
      closeHref={dashboardHref}
      origin={canvasOrigin(canvas.id)}
      dock="/canvases"
      portal
    >
      <WebCanvas
        canvasId={canvas.id}
        appName={APP_NAME}
        title={canvas.title}
        initialState={canvas.state}
        initialUpdatedAt={canvas.updatedAt}
        readOnly={canvas.readOnly}
        plan={canvas.plan}
        shareToken={canvas.shareToken}
        dashboardHref={dashboardHref}
        framed
      />
    </WindowLayer>
  );
}
