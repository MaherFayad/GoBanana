/**
 * /c/:id opened from a site page, while the server loads the board: the canvas window opens at
 * once with its skeleton, and the real window takes over in place (WindowShell).
 */
import { CanvasSkeletonWindow } from "@/canvas/CanvasSkeleton";
import { WindowShell } from "@/components/window/WindowShell";

export default function CanvasWindowLoading() {
  return (
    <WindowShell kind="canvas" labels={{ en: "Loading canvas", ar: "جار تحميل اللوحة" }} closeTo="canvases" portal>
      <CanvasSkeletonWindow />
    </WindowShell>
  );
}
