"use client";

import { useStore, type NodeProps } from "@xyflow/react";
import { useCanvasActions } from "../context";
import { ChevronDownIcon, ChevronEndIcon } from "../icons";
import { ZONE_LABEL_SPACE } from "@/lib/layout";
import { ZONE_LABELS } from "../labels";
import { LAYOUT_LABELS, LAYOUTS } from "../layout-adapter";
import { SECTION_HEADER_HEIGHT } from "../state";
import type { SectionFlowNode } from "../types";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

type Kid = { parentId?: string; type?: string; position: { y: number }; height?: number; measured?: { height?: number }; data: unknown };

/**
 * Label tops for a section's zones, as "artTop|uiTop" (uiTop -1 when there is no room or no UI
 * items), or "" when the section has no art direction items. A string keeps useStore re-renders
 * to real changes.
 */
export function zoneLabelKey(nodes: readonly Kid[], sectionId: string): string {
  let artMin = Infinity;
  let artBottom = -Infinity;
  let uiMin = Infinity;
  for (const n of nodes) {
    if (n.parentId !== sectionId) continue;
    const art = n.type === "image" && (n.data as { zone?: unknown }).zone === "art";
    const y = n.position.y;
    if (art) {
      artMin = Math.min(artMin, y);
      artBottom = Math.max(artBottom, y + (n.height ?? n.measured?.height ?? 0));
    } else {
      uiMin = Math.min(uiMin, y);
    }
  }
  if (!Number.isFinite(artMin)) return "";
  const artTop = Math.max(SECTION_HEADER_HEIGHT, artMin - ZONE_LABEL_SPACE);
  const uiTop = Number.isFinite(uiMin) && uiMin - ZONE_LABEL_SPACE >= artBottom ? uiMin - ZONE_LABEL_SPACE : -1;
  return `${artTop}|${uiTop}`;
}

/** Titled frame (React Flow group) for one direction. */
export function SectionNode({ id, data, selected }: NodeProps<SectionFlowNode>) {
  const actions = useCanvasActions();
  const count = useStore((s) => s.nodes.reduce((n, node) => (node.parentId === id ? n + 1 : n), 0));
  // Zone labels: when the section holds art direction items, "Art direction" sits above the art
  // block and "UI references" above the rest, where arrange and placement leave room (lib/layout).
  const zones = useStore((s) => zoneLabelKey(s.nodes, id));
  const [artTop, uiTop] = zones ? zones.split("|").map(Number) : [];
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
              selectAll
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
        {!collapsed && artTop !== undefined && (
          <p className="bn-zone-label" style={{ insetBlockStart: artTop }}>
            {ZONE_LABELS.art}
          </p>
        )}
        {!collapsed && uiTop !== undefined && uiTop >= 0 && (
          <p className="bn-zone-label" style={{ insetBlockStart: uiTop }}>
            {ZONE_LABELS.ui}
          </p>
        )}
      </div>
    </>
  );
}
