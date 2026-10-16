"use client";

/**
 * X post tile (lib/xpost). Web and shared canvas: X's official embed, loaded lazily the first
 * time the tile is on screen, so videos play inside the post; until then (or if X cannot load)
 * a card with the author, the text and "Open on X". Inline (MCP Apps) it is always the card,
 * without the post text (DECISIONS.md 2026-10-16). Placed, arranged, kept or dropped, marked
 * Ship or Explore and noted like any reference; its source chip is the post link.
 */
import type { NodeProps } from "@xyflow/react";
import { useEffect, useRef, useState } from "react";
import { postCredit } from "@/lib/xpost";
import { useCanvasActions } from "../context";
import { tagLabel } from "../labels";
import type { XPostFlowNode } from "../types";
import { embedPost } from "../x-embed";
import { ArtChip, SourceChip, TagChip } from "./chips";
import { CultureChip } from "./CultureChip";
import { NoteEditor } from "./ImageNode";
import { NodeMenu, type MenuItem } from "./NodeMenu";
import { Resizer } from "./Resizer";
import { LinkedText } from "../linkify";

function pageTheme(el: HTMLElement | null): "light" | "dark" {
  const set = el?.closest("[data-theme]")?.getAttribute("data-theme");
  if (set === "light" || set === "dark") return set;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function XPostNode({ id, data, selected, parentId }: NodeProps<XPostFlowNode>) {
  const actions = useCanvasActions();
  const editing = actions.editingId === id;
  const credit = postCredit(data);
  const frame = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [embed, setEmbed] = useState<"off" | "waiting" | "loading" | "ready" | "failed">(actions.embedX ? "waiting" : "off");

  // Lazy: X's script loads only once the tile is on screen (or near it).
  useEffect(() => {
    if (embed !== "waiting" || !frame.current) return;
    const el = frame.current;
    if (typeof IntersectionObserver === "undefined") {
      setEmbed("loading");
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        setEmbed("loading");
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [embed]);

  useEffect(() => {
    if (embed !== "loading" || !slot.current) return;
    let live = true;
    const el = slot.current;
    void embedPost(el, data.postId, pageTheme(el)).then((ok) => {
      if (live) setEmbed(ok ? "ready" : "failed");
    });
    return () => {
      live = false;
    };
  }, [embed, data.postId]);

  const items: MenuItem[] = [
    { label: data.note ? "Edit note" : "Add note", keys: "F2", onSelect: () => actions.setEditing(id) },
    {
      label: data.tag === "ship" ? "Mark as Explore" : "Mark as Ship",
      onSelect: () => {
        const tag = data.tag === "ship" ? "explore" : "ship";
        actions.updateData<"xpost">(id, { tag });
        actions.announce(`Marked as ${tagLabel(tag)}`);
      },
    },
  ];
  if (data.tag) items.push({ label: "Clear Ship or Explore mark", onSelect: () => actions.updateData<"xpost">(id, { tag: null }) });

  const showCard = embed !== "ready";
  return (
    <>
      <Resizer type="xpost" selected={selected} />
      <div className="bn-node bn-image bn-xpost" data-testid={`tile-${id}`} data-embed={embed}>
        <div className="bn-image-frame bn-xpost-frame" ref={frame}>
          {/* X's script draws the post here. nodrag and nowheel so the post and its video take the pointer. */}
          {embed !== "off" && <div ref={slot} className="bn-xpost-embed nodrag nowheel" data-testid="x-embed" hidden={embed !== "ready"} />}
          {showCard && (
            <div className="bn-xpost-card" data-testid="x-card">
              <p className="bn-xpost-author">
                <span className="bn-xpost-name" dir="auto">{data.authorName}</span>{" "}
                <span className="bn-xpost-handle">@{data.authorHandle}</span>
              </p>
              {embed !== "off" && data.text && (
                <p className="bn-xpost-text" dir="auto">
                  {data.text}
                </p>
              )}
              <a className="bn-xpost-open nodrag nopan" href={data.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">
                Open on X
                <span className="st-visually-hidden"> ({credit}, opens in a new tab)</span>
              </a>
              {embed === "loading" && <p className="bn-linkcard-why">Loading the post from X…</p>}
              {embed === "failed" && <p className="bn-linkcard-why">The post could not load here.</p>}
            </div>
          )}
          <div className="bn-node-bar bn-node-bar-source">
            <SourceChip site="x.com" url={data.sourceUrl} />
          </div>
        </div>
        {editing ? (
          <NoteEditor
            initial={data.note ?? ""}
            label={`Note for ${credit}`}
            onDone={(value) => {
              if (value !== null) actions.updateData<"xpost">(id, { note: value.trim() || null });
              actions.setEditing(null);
              actions.focusNode(id);
            }}
          />
        ) : (
          data.note && (
            <p className="bn-image-note">
              <LinkedText text={data.note} />
            </p>
          )
        )}
        <div className="bn-node-bar bn-node-bar-top">
          {data.zone === "art" && <ArtChip />}
          <span className="st-chip bn-chip" data-tone="neutral" data-testid="x-chip">
            <span>X post</span>
          </span>
          {data.screenshotUrl && (
            <span className="st-chip bn-chip" data-tone="neutral" data-testid="x-shot-chip">
              <span>Screenshot</span>
            </span>
          )}
          {data.tag && <TagChip tag={data.tag} />}
          {data.culture && <CultureChip culture={data.culture} />}
          <span className="bn-grow" />
          <NodeMenu nodeId={id} label={credit} parentId={parentId} items={items} sourceUrl={data.sourceUrl} />
        </div>
      </div>
    </>
  );
}
