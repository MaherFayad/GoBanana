"use client";

/**
 * Alignment guides while dragging (spec section 5): thin lines in --st-canvas-snap-guide-color,
 * drawn in board space inside the viewport and divided by the zoom so they stay 1px on screen.
 */
import { useStore, ViewportPortal } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { SnapGuide } from "./snapping";

export function SnapGuides({ guides }: { guides: readonly SnapGuide[] }) {
  // Only follows the zoom while there are guides to draw (no re-render per zoom tick otherwise).
  const zoom = useStore((s) => (guides.length > 0 ? s.transform[2] : 1));
  if (guides.length === 0) return null;
  const px = 1 / zoom;
  return (
    <ViewportPortal>
      <div aria-hidden="true" data-testid="snap-guides">
        {guides.map((g) => {
          const box =
            g.axis === "x"
              ? { x: g.position - px / 2, y: g.start, w: px, h: g.end - g.start }
              : { x: g.start, y: g.position - px / 2, w: g.end - g.start, h: px };
          const style = { "--x": `${box.x}px`, "--y": `${box.y}px`, "--w": `${box.w}px`, "--h": `${box.h}px` } as CSSProperties;
          return <div key={`${g.axis}-${g.position}-${g.start}`} className="bn-snap-guide" style={style} />;
        })}
      </div>
    </ViewportPortal>
  );
}
