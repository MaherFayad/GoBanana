/**
 * Loading state for /c/:id (plan WP-C step 6): a skeleton of the canvas window on the desk,
 * shown while the server loads the board. Title bar with dimmed traffic lights, rail, panel rows
 * and the board on its inset rounded corner, all on the shimmer bars from
 * studio-components.css (still under reduced motion). The region carries aria-busy and a
 * status line for screen readers.
 */
import { CanvasSkeletonWindow } from "@/canvas/CanvasSkeleton";

export default function CanvasLoading() {
  return (
    <div className="bn-skel" aria-busy="true">
      <p className="st-visually-hidden" role="status">
        Loading canvas
      </p>
      <CanvasSkeletonWindow />
    </div>
  );
}
