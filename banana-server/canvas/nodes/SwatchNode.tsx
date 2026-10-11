"use client";

import type { NodeProps } from "@xyflow/react";
import type { CSSProperties } from "react";
import { contrastRatio, TEXT_MIN, UI_MIN } from "@/lib/palette/contrast";
import { useCanvasActions } from "../context";
import { CheckIcon, WarningIcon } from "../icons";
import { tagLabel } from "../labels";
import type { SwatchFlowNode } from "../types";
import { TagChip } from "./chips";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";

function verdict(ratio: number): { text: string; pass: boolean } {
  if (ratio >= TEXT_MIN) return { text: "AA", pass: true };
  if (ratio >= UI_MIN) return { text: "UI only", pass: true };
  return { text: "Fails", pass: false };
}

function safeRatio(a: string, b: string): number | null {
  try {
    const r = contrastRatio(a, b);
    return Number.isFinite(r) ? r : null;
  } catch {
    return null;
  }
}

function ContrastRow({ hex, against, name }: { hex: string; against: string; name: string }) {
  const ratio = safeRatio(hex, against);
  if (ratio === null) return null;
  const v = verdict(ratio);
  return (
    <li>
      {/* Live "Aa" sample (CSS content) of the color as text on the background. Decorative. */}
      <span className="bn-contrast-sample" style={{ "--sample-bg": against, "--sample-fg": hex } as CSSProperties} aria-hidden="true" />
      <span className="bn-contrast-ratio">
        {name} {ratio.toFixed(2)}:1
      </span>
      <span className="st-chip" data-tone={v.pass ? "success" : "danger"}>
        {v.pass ? <CheckIcon size={12} /> : <WarningIcon size={12} />}
        <span>{v.text}</span>
      </span>
    </li>
  );
}

export function SwatchNode({ id, data, parentId }: NodeProps<SwatchFlowNode>) {
  const actions = useCanvasActions();
  const editing = actions.editingId === id;
  const other = data.tag === "ship" ? "explore" : "ship";

  const items: MenuItem[] = [
    { label: "Rename role", keys: "F2", onSelect: () => actions.setEditing(id) },
    {
      label: `Mark as ${tagLabel(other)}`,
      onSelect: () => {
        actions.updateData<"swatch">(id, { tag: other });
        actions.announce(`Marked as ${tagLabel(other)}`);
      },
    },
  ];

  return (
    <div className="bn-node bn-swatch">
      <div
        className="bn-swatch-color"
        style={{ "--bn-swatch": data.hex } as CSSProperties}
        role="img"
        aria-label={`Color sample ${data.hex}`}
      />
      <div className="bn-swatch-info">
        {editing ? (
          <NoteEditor
            multiline={false}
            initial={data.role ?? ""}
            label="Color role"
            onDone={(value) => {
              if (value !== null) actions.updateData<"swatch">(id, { role: value.trim() || null });
              actions.setEditing(null);
              actions.focusNode(id);
            }}
          />
        ) : (
          <span className="bn-swatch-role">{data.role || "No role yet"}</span>
        )}
        <span className="bn-swatch-code">{data.hex}</span>
        {data.oklch && <span className="bn-swatch-code">{data.oklch}</span>}
        <ul className="bn-contrast" aria-label="Contrast">
          <ContrastRow hex={data.hex} against="#ffffff" name="On white" />
          <ContrastRow hex={data.hex} against="#000000" name="On black" />
        </ul>
      </div>
      <div className="bn-node-bar bn-node-bar-static">
        <TagChip tag={data.tag} />
        <span className="bn-grow" />
        <NodeMenu nodeId={id} label={`color ${data.hex}`} parentId={parentId} items={items} resizable={false} />
      </div>
    </div>
  );
}
