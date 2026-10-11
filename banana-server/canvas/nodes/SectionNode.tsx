"use client";

import { useStore, type NodeProps } from "@xyflow/react";
import { useCanvasActions } from "../context";
import { ChevronDownIcon, ChevronEndIcon } from "../icons";
import { LAYOUT_LABELS, LAYOUTS } from "../layout-adapter";
import type { SectionFlowNode } from "../types";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

/** Titled frame (React Flow group) for one direction. */
export function SectionNode({ id, data, selected }: NodeProps<SectionFlowNode>) {
  const actions = useCanvasActions();
  const count = useStore((s) => s.nodes.reduce((n, node) => (node.parentId === id ? n + 1 : n), 0));
  const editing = actions.editingId === id;
  const collapsed = Boolean(data.collapsed);

  const items: MenuItem[] = [
    { label: "Rename section", keys: "F2", onSelect: () => actions.setEditing(id) },
    { label: collapsed ? "Expand section" : "Collapse section", onSelect: () => actions.toggleCollapse(id) },
    ...LAYOUTS.map((layout, i) => ({
      label: `Arrange contents: ${LAYOUT_LABELS[layout]}`,
      separator: i === 0,
      onSelect: () => actions.arrangeSection(id, layout),
    })),
  ];

  return (
    <>
      {!collapsed && <Resizer type="section" selected={selected} />}
      <div className="bn-node bn-section" data-collapsed={collapsed ? "true" : "false"}>
        <div className="bn-section-header">
          {!actions.readOnly && (
            <button
              type="button"
              className="st-btn nodrag"
              data-variant="ghost"
              data-size="xs"
              data-icon-only=""
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} section ${data.title}`}
              onClick={(e) => {
                e.stopPropagation();
                actions.toggleCollapse(id);
              }}
            >
              {collapsed ? <ChevronEndIcon size={16} /> : <ChevronDownIcon size={16} />}
            </button>
          )}
          <span className="bn-section-dot" aria-hidden="true" />
          {editing ? (
            <NoteEditor
              multiline={false}
              initial={data.title}
              label="Section title"
              onDone={(value) => {
                if (value !== null && value.trim()) actions.updateData<"section">(id, { title: value.trim() });
                actions.setEditing(null);
                actions.focusNode(id);
              }}
            />
          ) : (
            <p className="bn-section-title">{data.title}</p>
          )}
          <span className="bn-section-count">
            {count} {count === 1 ? "item" : "items"}
          </span>
          <NodeMenu nodeId={id} label={`section ${data.title}`} items={items} movable={false} />
        </div>
      </div>
    </>
  );
}
