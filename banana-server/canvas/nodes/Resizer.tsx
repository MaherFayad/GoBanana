"use client";

import { NodeResizer, type OnResizeEnd, type OnResizeStart } from "@xyflow/react";
import type { MouseEvent } from "react";
import { useCanvasActions } from "../context";
import { MIN_SIZE, type CanvasNodeType } from "../types";

/**
 * Drag handles for resizing. Keyboard and menu alternatives: "+" / "-" keys, "Make bigger" /
 * "Make smaller". Handles keep one on-screen size at any zoom: React Flow's autoScale only
 * grows them when zoomed out, so it is off and canvas.css counter-scales by `--bn-chrome`.
 *
 * `onFit` runs on a double click of a bottom handle or the bottom edge (notes: "Fit to text").
 */
export function Resizer({
  type,
  selected,
  keepAspectRatio = false,
  onResizeStart,
  onResizeEnd,
  onFit,
}: {
  type: CanvasNodeType;
  selected: boolean;
  keepAspectRatio?: boolean;
  onResizeStart?: OnResizeStart;
  onResizeEnd?: OnResizeEnd;
  onFit?: () => void;
}) {
  const { readOnly } = useCanvasActions();
  const min = MIN_SIZE[type];
  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (!onFit) return;
    const control = (e.target as HTMLElement).closest(".react-flow__resize-control");
    if (!control?.classList.contains("bottom")) return;
    e.stopPropagation();
    onFit();
  };
  return (
    // display: contents keeps the handles positioned against the node wrapper.
    <div className="bn-resizer" onDoubleClick={onDoubleClick}>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={min.w}
        minHeight={min.h}
        keepAspectRatio={keepAspectRatio}
        autoScale={false}
        handleClassName="bn-resize-handle"
        lineClassName="bn-resize-line"
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
      />
    </div>
  );
}
