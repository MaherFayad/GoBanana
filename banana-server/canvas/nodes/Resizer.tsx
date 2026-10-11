"use client";

import { NodeResizer } from "@xyflow/react";
import { useCanvasActions } from "../context";
import { MIN_SIZE, type CanvasNodeType } from "../types";

/** Drag handles for resizing. Keyboard and menu alternatives: "+" / "-" keys, "Make bigger" / "Make smaller". */
export function Resizer({ type, selected, keepAspectRatio = false }: { type: CanvasNodeType; selected: boolean; keepAspectRatio?: boolean }) {
  const { readOnly } = useCanvasActions();
  const min = MIN_SIZE[type];
  return (
    <NodeResizer
      isVisible={selected && !readOnly}
      minWidth={min.w}
      minHeight={min.h}
      keepAspectRatio={keepAspectRatio}
      handleClassName="bn-resize-handle"
      lineClassName="bn-resize-line"
    />
  );
}
