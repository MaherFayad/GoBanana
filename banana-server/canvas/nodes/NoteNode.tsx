"use client";

import type { NodeProps } from "@xyflow/react";
import { useCanvasActions } from "../context";
import { CheckIcon } from "../icons";
import { NOTE_COLORS, type NoteColor, type NoteFlowNode } from "../types";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

const COLOR_NAMES: Record<NoteColor, string> = {
  yellow: "Yellow",
  blue: "Blue",
  pink: "Pink",
  green: "Green",
  gray: "Gray",
};

function noteColor(c: string | null | undefined): NoteColor {
  return (NOTE_COLORS as readonly string[]).includes(c ?? "") ? (c as NoteColor) : "yellow";
}

export function NoteNode({ id, data, selected, parentId }: NodeProps<NoteFlowNode>) {
  const actions = useCanvasActions();
  const color = noteColor(data.color);
  const editing = actions.editingId === id;

  const setColor = (c: NoteColor) => {
    if (c === color) return;
    actions.updateData<"note">(id, { color: c });
    actions.announce(`Note color is now ${COLOR_NAMES[c]}`);
  };

  const items: MenuItem[] = [
    { label: "Edit note", keys: "F2", onSelect: () => actions.setEditing(id) },
    ...NOTE_COLORS.filter((c) => c !== color).map((c, i) => ({
      label: `Color: ${COLOR_NAMES[c]}`,
      separator: i === 0,
      onSelect: () => setColor(c),
    })),
  ];

  return (
    <>
      <Resizer type="note" selected={selected} />
      <div
        className="bn-node bn-note"
        data-color={color}
        onDoubleClick={() => !actions.readOnly && actions.setEditing(id)}
      >
        {editing ? (
          <NoteEditor
            initial={data.text}
            label="Note text"
            onDone={(value) => {
              if (value !== null) actions.updateData<"note">(id, { text: value });
              actions.setEditing(null);
              actions.focusNode(id);
            }}
          />
        ) : (
          <p className={`bn-note-text${data.text.trim() ? "" : " bn-note-empty"}`}>
            {data.text.trim() || "Empty note. Press F2 or double click to write."}
          </p>
        )}
        <div className="bn-node-bar">
          <span className="bn-grow" />
          <NodeMenu nodeId={id} label="note" parentId={parentId} items={items} />
        </div>
        {/* Hover, focus and selection chrome: a second route to the color next to the menu. */}
        {!actions.readOnly && (
          <div className="bn-note-chrome nodrag nopan" role="group" aria-label="Note color">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className="bn-swatch-button"
                data-color={c}
                aria-pressed={c === color}
                aria-label={COLOR_NAMES[c]}
                onClick={(e) => {
                  e.stopPropagation();
                  setColor(c);
                }}
              >
                <CheckIcon size={16} />
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
