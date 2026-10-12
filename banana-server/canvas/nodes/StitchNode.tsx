"use client";

/**
 * A Frankenstein page (stitch frame): parts cut from different references, stacked in rows inside
 * a frame drawn for the platform (phone, tablet, browser). Spec: docs/stitch-spec.md.
 *
 * Every slot shows a crop of its part's hotlinked image with CSS only, a source chip (hard rule
 * 3) and its role. Views: collage (as is), wireframe (grey, softened, big role labels) and even
 * (dark parts inverted so the page reads as one theme).
 *
 * Keys on a focused slot (one tab stop for the page, arrows move between slots):
 * Alt + arrows move the slot, Enter recrops it, Delete removes it, F2 edits its note, M opens
 * its menu ("Swap with part..." is the keyboard route of dropping a part on it), Escape goes back
 * to the frame. Pointer: drag a slot onto another to trade places, drop a part from the Parts tab
 * on a slot to swap it, or on the page to add a row. The shared view can switch views only.
 */
import { useStore, type NodeProps } from "@xyflow/react";
import {
  useCallback,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Tooltip } from "@/components/studio/Tooltip";
import { STITCH_MODES, type Part, type StitchMode, type StitchSlot } from "@/lib/stitch/types";
import { useCanvasActions } from "../context";
import { ExternalIcon } from "../icons";
import { siteName } from "../labels";
import { LinkedText } from "../linkify";
import { FALLBACK_IMAGE_ASPECT, slotFilter } from "../stitch/crop";
import { CroppedImage } from "../stitch/CroppedImage";
import { PART_DND_TYPE, SLOT_DND_TYPE, useStitch } from "../stitch/context";
import {
  appendPart,
  findSlot,
  joinRow,
  moveSlot,
  removeSlot,
  roleLabel,
  setSlotNote,
  swapCandidates,
  swapPart,
  swapSlots,
  type EditResult,
  type MoveDirection,
} from "../stitch/edit";
import type { StitchFlowNode, StitchNodeData } from "../types";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, PopupMenu, type MenuCloseReason, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";

export const MODE_LABELS: Record<StitchMode, string> = { collage: "Collage", wireframe: "Wireframe", even: "Even" };

const PLATFORM_LABELS = { mobile: "Phone", tablet: "Tablet", website: "Website", webapp: "Web app" } as const;

const ARROW_DIR: Record<string, MoveDirection> = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };

const hasType = (e: DragEvent, type: string) => Array.from(e.dataTransfer.types).includes(type);

/** One tab stop for the radio group; arrows pick the next view. */
export function ModeSwitch({ mode, onMode, label }: { mode: StitchMode; onMode: (m: StitchMode) => void; label: string }) {
  const refs = useRef<Partial<Record<StitchMode, HTMLButtonElement | null>>>({});
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = STITCH_MODES.indexOf(mode);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (at + 1) % STITCH_MODES.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (at - 1 + STITCH_MODES.length) % STITCH_MODES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = STITCH_MODES.length - 1;
    if (next === null) return;
    e.preventDefault();
    e.stopPropagation();
    const m = STITCH_MODES[next]!;
    onMode(m);
    refs.current[m]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="bn-stitch-modes nodrag nopan nokey" onKeyDown={onKey}>
      {STITCH_MODES.map((m) => (
        <button
          key={m}
          ref={(el) => {
            refs.current[m] = el;
          }}
          type="button"
          role="radio"
          aria-checked={m === mode}
          tabIndex={m === mode ? 0 : -1}
          className="bn-stitch-mode"
          onClick={(e) => {
            e.stopPropagation();
            onMode(m);
          }}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}

/** Source chip for a slot; only the focused slot's link is a tab stop (roving). */
function SlotSource({ site, url, tabbable }: { site: string; url: string; tabbable: boolean }) {
  return (
    <Tooltip content={url} side="top" wide>
      <a
        className="st-chip bn-source bn-stitch-source nodrag nopan"
        data-tone="neutral"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        tabIndex={tabbable ? 0 : -1}
        draggable={false}
      >
        <ExternalIcon size={12} />
        <span>{site}</span>
        <span className="st-visually-hidden"> (source, opens in a new tab)</span>
      </a>
    </Tooltip>
  );
}

type SlotMenu = { slotId: string; kind: "slot" | "swap"; point: { x: number; y: number } | null };

export function StitchNode({ id, data, selected, parentId, height }: NodeProps<StitchFlowNode>) {
  const actions = useCanvasActions();
  const { partsById, parts, openCrop } = useStitch();
  const readOnly = actions.readOnly;
  const [viewMode, setViewMode] = useState<StitchMode | null>(null);
  const mode = readOnly ? (viewMode ?? data.mode) : data.mode;
  const [active, setActive] = useState<string | null>(null);
  const [menu, setMenu] = useState<SlotMenu | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  // Slots are found in the DOM by id (not refs), so menu items built in render can focus them.
  const pageId = `bn-stitch-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const slotEl = (slotId: string) =>
    document.getElementById(pageId)?.querySelector<HTMLElement>(`[data-slot-id="${CSS.escape(slotId)}"]`) ?? null;
  const [menuTrigger, setMenuTrigger] = useState<HTMLElement | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const editingTitle = actions.editingId === id;
  const title = data.title || "Frankenstein page";
  const zoomedOut = useStore((s) => s.transform[2] < 0.35);

  const flat = data.rows.flatMap((r) => r.slots.map((s) => s.id));
  const activeId = active && flat.includes(active) ? active : (flat[0] ?? null);

  // The frame is as tall as its rows: the node height follows the content (like notes).
  const { setNodeHeight } = actions;
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      const h = Math.ceil(el.offsetHeight);
      if (h > 0 && Math.abs(h - (height ?? 0)) > 1) setNodeHeight(id, h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height, id, setNodeHeight]);

  const focusSlot = (slotId: string) => {
    setActive(slotId);
    requestAnimationFrame(() => slotEl(slotId)?.focus({ preventScroll: true }));
  };

  const apply = (r: EditResult) => {
    if (r.data) {
      actions.updateData<"stitch">(id, r.data as Partial<StitchNodeData>);
      if (r.focus) focusSlot(r.focus);
      else actions.focusNode(id);
    }
    actions.announce(r.message);
  };

  const setMode = (m: StitchMode) => {
    if (readOnly) setViewMode(m);
    else actions.updateData<"stitch">(id, { mode: m });
    actions.announce(`${MODE_LABELS[m]} view`);
  };

  const openMenu = (slotId: string, kind: SlotMenu["kind"], point: SlotMenu["point"] = null) => {
    setMenuTrigger(slotEl(slotId));
    setMenu({ slotId, kind, point });
  };

  // Stable while the menu is open (PopupMenu refocuses its first item when these change).
  const menuSlotId = menu?.slotId ?? null;
  const closeMenu = useCallback(
    (reason: MenuCloseReason) => {
      setMenu(null);
      if (!menuSlotId || (reason !== "escape" && reason !== "tab")) return;
      setActive(menuSlotId);
      requestAnimationFrame(() =>
        document.getElementById(pageId)?.querySelector<HTMLElement>(`[data-slot-id="${CSS.escape(menuSlotId)}"]`)?.focus({ preventScroll: true }),
      );
    },
    [menuSlotId, pageId],
  );
  const triggerRef = useMemo(() => ({ current: menuTrigger }), [menuTrigger]);

  const openSwap = (slot: StitchSlot) => {
    const current = partsById.get(slot.partId);
    const list = swapCandidates(parts, current?.role ?? slot.role, slot.partId);
    if (list.length === 0) {
      actions.announce("No other parts in the library. Cut parts from images first.");
      focusSlot(slot.id);
      return;
    }
    openMenu(slot.id, "swap");
  };

  const slotItems = (slot: StitchSlot): MenuItem[] => {
    const part = partsById.get(slot.partId);
    const pos = findSlot(data, slot.id);
    const rowLen = pos ? data.rows[pos.row]!.slots.length : 1;
    const items: MenuItem[] = [];
    if (part) items.push({ label: "Recrop", keys: "Enter", onSelect: () => openCrop({ kind: "slot", nodeId: id, slotId: slot.id }), movesFocus: true });
    items.push({ label: "Swap with part...", onSelect: () => openSwap(slot), movesFocus: true });
    items.push({ label: slot.note ? "Edit note" : "Add note", keys: "F2", onSelect: () => setNoteFor(slot.id), movesFocus: true });
    (["up", "down", "left", "right"] as const).forEach((d, i) =>
      items.push({
        label: `Move ${d}`,
        keys: `Alt+Arrow${d.charAt(0).toUpperCase()}${d.slice(1)}`,
        separator: i === 0,
        onSelect: () => apply(moveSlot(data, slot.id, d)),
        movesFocus: true,
      }),
    );
    if (pos && pos.row > 0) items.push({ label: "Join the row above", onSelect: () => apply(joinRow(data, slot.id, "up")), movesFocus: true });
    if (pos && pos.row < data.rows.length - 1)
      items.push({ label: "Join the row below", onSelect: () => apply(joinRow(data, slot.id, "down")), movesFocus: true });
    if (rowLen > 1 && pos) items.push({ label: "Own row", onSelect: () => apply(moveSlot(data, slot.id, "down")), movesFocus: true });
    if (part) items.push({ label: "Open source", separator: true, onSelect: () => window.open(part.sourceUrl, "_blank", "noopener,noreferrer") });
    items.push({ label: "Remove from page", keys: "Delete", danger: true, separator: true, onSelect: () => apply(removeSlot(data, slot.id)) });
    return items;
  };

  const swapItems = (slot: StitchSlot): MenuItem[] => {
    const current = partsById.get(slot.partId);
    const seen = new Map<string, number>();
    const role = current?.role ?? slot.role;
    const list = swapCandidates(parts, role, slot.partId);
    return list.map((p, i) => {
      let label = `${roleLabel(p.role)} from ${siteName(p.sourceSite, p.sourceUrl)}${p.title ? `: ${p.title.slice(0, 40)}` : ""}`;
      const n = (seen.get(label) ?? 0) + 1;
      seen.set(label, n);
      if (n > 1) label = `${label} (${n})`;
      return {
        label,
        separator: i > 0 && p.role !== role && list[i - 1]?.role === role,
        onSelect: () => apply(swapPart(data, slot.id, p)),
        movesFocus: true,
      };
    });
  };

  const onSlotKey = (e: KeyboardEvent<HTMLDivElement>, slot: StitchSlot) => {
    if (e.target !== e.currentTarget) return;
    const pos = findSlot(data, slot.id);
    if (!pos) return;
    const dir = ARROW_DIR[e.key];
    const plain = !e.altKey && !e.ctrlKey && !e.metaKey;
    if (dir && e.altKey && !e.ctrlKey && !e.metaKey) {
      if (!readOnly) apply(moveSlot(data, slot.id, dir));
    } else if (dir && plain) {
      let row = pos.row;
      let col = pos.col;
      if (dir === "left") col -= 1;
      else if (dir === "right") col += 1;
      else row += dir === "up" ? -1 : 1;
      const r = data.rows[row];
      if (r) {
        const target = r.slots[Math.max(0, Math.min(col, r.slots.length - 1))];
        if (target && target.id !== slot.id) focusSlot(target.id);
      }
    } else if ((e.key === "Home" || e.key === "End") && plain) {
      const t = e.key === "Home" ? flat[0] : flat[flat.length - 1];
      if (t) focusSlot(t);
    } else if (e.key === "Enter" && plain) {
      if (readOnly || !partsById.has(slot.partId)) return;
      openCrop({ kind: "slot", nodeId: id, slotId: slot.id });
    } else if ((e.key === "Delete" || e.key === "Backspace") && plain) {
      if (!readOnly) apply(removeSlot(data, slot.id));
    } else if (e.key === "F2" && plain && !e.shiftKey) {
      if (!readOnly) setNoteFor(slot.id);
    } else if ((plain && (e.key === "m" || e.key === "M" || e.key === "ContextMenu")) || (e.shiftKey && e.key === "F10")) {
      if (!readOnly) openMenu(slot.id, "slot");
    } else if (e.key === "Escape") {
      actions.focusNode(id);
    } else {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
  };

  // ---------------------------------------------------------------- drags
  const onSlotDragStart = (e: DragEvent<HTMLDivElement>, slot: StitchSlot) => {
    e.stopPropagation();
    e.dataTransfer.setData(SLOT_DND_TYPE, `${id} ${slot.id}`);
    e.dataTransfer.effectAllowed = "move";
  };
  const onSlotDragOver = (e: DragEvent<HTMLDivElement>, slot: StitchSlot) => {
    if (readOnly || !(hasType(e, PART_DND_TYPE) || hasType(e, SLOT_DND_TYPE))) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = hasType(e, PART_DND_TYPE) ? "copy" : "move";
    if (dropOn !== slot.id) setDropOn(slot.id);
  };
  const onSlotDrop = (e: DragEvent<HTMLDivElement>, slot: StitchSlot) => {
    setDropOn(null);
    if (readOnly) return;
    const partId = e.dataTransfer.getData(PART_DND_TYPE);
    const moved = e.dataTransfer.getData(SLOT_DND_TYPE);
    if (!partId && !moved) return;
    e.preventDefault();
    e.stopPropagation();
    if (partId) {
      const part = partsById.get(partId);
      if (part) apply(swapPart(data, slot.id, part));
      return;
    }
    const [node, from] = moved.split(" ");
    if (node !== id || !from) {
      actions.announce("Parts move within one page. Use Swap with part to bring in another.");
      return;
    }
    apply(swapSlots(data, from, slot.id));
  };
  const onPageDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (readOnly || !hasType(e, PART_DND_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };
  const onPageDrop = (e: DragEvent<HTMLDivElement>) => {
    const partId = e.dataTransfer.getData(PART_DND_TYPE);
    const part = partId ? partsById.get(partId) : undefined;
    if (readOnly || !part) return;
    e.preventDefault();
    e.stopPropagation();
    apply(appendPart(data, part));
  };

  const nodeItems: MenuItem[] = [
    { label: "Rename", keys: "F2", onSelect: () => actions.setEditing(id) },
    ...STITCH_MODES.map((m, i) => ({
      label: `${MODE_LABELS[m]} view`,
      checked: m === mode,
      separator: i === 0,
      onSelect: () => setMode(m),
    })),
  ];

  const menuSlot = menu ? data.rows.flatMap((r) => r.slots).find((s) => s.id === menu.slotId) : undefined;
  const fallback = FALLBACK_IMAGE_ASPECT[data.platform] ?? FALLBACK_IMAGE_ASPECT.website;

  const renderSlot = (slot: StitchSlot, rowIndex: number, flexGrow: number) => {
    const part: Part | undefined = partsById.get(slot.partId);
    const site = part ? siteName(part.sourceSite, part.sourceUrl) : "a missing part";
    const role = roleLabel(slot.role);
    const isActive = slot.id === activeId;
    const noteId = `${id}-${slot.id}-note`;
    return (
      <div
        key={slot.id}
        className="bn-stitch-slot nodrag nopan"
        role="group"
        aria-roledescription="page part"
        aria-label={`${role}, from ${site}, row ${rowIndex + 1} of ${data.rows.length}`}
        aria-describedby={slot.note || part?.note ? noteId : undefined}
        aria-keyshortcuts={readOnly ? undefined : "Enter Delete Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight M"}
        tabIndex={isActive ? 0 : -1}
        data-slot-id={slot.id}
        data-theme-part={part?.theme ?? "unknown"}
        data-drop={dropOn === slot.id ? "" : undefined}
        style={{ flexGrow }}
        draggable={!readOnly}
        onFocus={(e) => {
          if (e.target === e.currentTarget) setActive(slot.id);
        }}
        onKeyDown={(e) => onSlotKey(e, slot)}
        onContextMenu={(e: ReactMouseEvent) => {
          if (readOnly) return;
          e.preventDefault();
          e.stopPropagation();
          setActive(slot.id);
          openMenu(slot.id, "slot", { x: e.clientX, y: e.clientY });
        }}
        onDragStart={(e) => onSlotDragStart(e, slot)}
        onDragOver={(e) => onSlotDragOver(e, slot)}
        onDragLeave={() => setDropOn((d) => (d === slot.id ? null : d))}
        onDrop={(e) => onSlotDrop(e, slot)}
      >
        {part ? (
          <CroppedImage
            src={part.imageUrl}
            crop={slot.crop ?? part.crop}
            alt={`${part.title ? `${part.title}, ` : ""}${role}`}
            width={part.imageWidth}
            height={part.imageHeight}
            fallbackAspect={fallback}
            filter={slotFilter(mode, part.theme)}
          />
        ) : (
          <div className="bn-crop bn-crop-placeholder">
            <span className="bn-crop-missing">This part is no longer in the library</span>
          </div>
        )}
        {mode === "wireframe" && (
          <span className="bn-stitch-wire-label" aria-hidden="true">
            {role}
          </span>
        )}
        <div className="bn-stitch-slot-bar">
          <span className="st-chip bn-chip bn-stitch-role" data-tone="neutral">
            {role}
          </span>
          {part && <SlotSource site={site} url={part.sourceUrl} tabbable={isActive} />}
        </div>
        {noteFor === slot.id ? (
          <div className="bn-stitch-note-edit nokey">
            <NoteEditor
              initial={slot.note ?? ""}
              label={`Note for ${role}`}
              onDone={(value) => {
                setNoteFor(null);
                if (value !== null) apply(setSlotNote(data, slot.id, value));
                else focusSlot(slot.id);
              }}
            />
          </div>
        ) : (
          (slot.note || part?.note) && (
            <p id={noteId} className="bn-stitch-note">
              <LinkedText text={slot.note || part?.note || ""} />
            </p>
          )
        )}
      </div>
    );
  };

  return (
    <>
      <Resizer type="stitch" selected={selected} />
      <div className="bn-node bn-stitch" data-platform={data.platform} data-mode={mode} data-chrome={zoomedOut ? "tiny" : undefined}>
        <div ref={measureRef} className="bn-stitch-measure">
          <div className="bn-stitch-head">
            <div className="bn-stitch-heading">
              <p className="bn-stitch-eyebrow">
                Frankenstein page · {PLATFORM_LABELS[data.platform]}
                {data.variant ? ` · variant ${data.variant}` : ""}
              </p>
              {editingTitle ? (
                <NoteEditor
                  multiline={false}
                  initial={title}
                  label="Frankenstein page title"
                  selectAll
                  onDone={(value) => {
                    if (value !== null && value.trim()) actions.updateData<"stitch">(id, { title: value.trim().slice(0, 120) });
                    actions.setEditing(null);
                    actions.focusNode(id);
                  }}
                />
              ) : (
                <p className="bn-stitch-title">{title}</p>
              )}
              {data.note && (
                <p className="bn-stitch-idea">
                  <LinkedText text={data.note} />
                </p>
              )}
            </div>
            <div className="bn-stitch-tools">
              <ModeSwitch mode={mode} onMode={setMode} label={`View for ${title}`} />
              <NodeMenu nodeId={id} label={`Frankenstein page ${title}`} parentId={parentId} items={nodeItems} />
            </div>
          </div>
          <div className="bn-stitch-frame" data-platform={data.platform}>
            {data.platform === "website" || data.platform === "webapp" ? (
              <div className="bn-stitch-browser" aria-hidden="true">
                <span className="bn-stitch-dots" />
                <span className="bn-stitch-url" />
              </div>
            ) : (
              <div className="bn-stitch-notch" aria-hidden="true" />
            )}
            <div
              id={pageId}
              className="bn-stitch-page nokey"
              role="group"
              aria-label={`Parts of ${title}. Arrow keys move between parts.${readOnly ? "" : " Alt and arrow keys move a part, Enter recrops, M opens its menu."}`}
              onDragOver={onPageDragOver}
              onDrop={onPageDrop}
            >
              {data.rows.length === 0 ? (
                <p className="bn-stitch-empty">
                  {readOnly ? "This page has no parts yet." : "No parts yet. Drag parts here from the Parts tab."}
                </p>
              ) : (
                data.rows.map((row, r) => (
                  <div key={row.id} className="bn-stitch-row" data-count={row.slots.length}>
                    {row.slots.map((slot, c) => renderSlot(slot, r, row.widths?.[c] ?? 1))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {menuSlot && (
          <PopupMenu
            open
            label={menu?.kind === "swap" ? `Swap ${roleLabel(menuSlot.role)} with part` : `Options for ${roleLabel(menuSlot.role)}`}
            items={menu?.kind === "swap" ? swapItems(menuSlot) : slotItems(menuSlot)}
            triggerRef={triggerRef}
            point={menu?.point ?? null}
            onClose={closeMenu}
          />
        )}
      </div>
    </>
  );
}
