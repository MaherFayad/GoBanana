"use client";

/**
 * Upload one of your own images (Pro, spec section 12) and put it on the canvas.
 *
 * A real file input with a visible label, so it works with the keyboard (Tab, then
 * Enter or Space) and with screen readers. Free users still see the control; using it
 * shows a plain upgrade note instead of a file picker. Only file bytes are sent:
 * there is no "upload from URL" (hard rule 2).
 */
import { useReactFlow } from "@xyflow/react";
import { useId, useRef, useState } from "react";
import { limitsFor, type Plan } from "@/lib/quota";
import { checkUploadFile, UPLOAD_ACCEPT, UPLOAD_FIELD, UPLOAD_MESSAGES, type UploadErrorCode } from "@/lib/uploads/rules";
import { useCanvasActions } from "./context";
import { newNodeId, referenceSize } from "./factory";
import type { CanvasFlowNode, UploadFlowNode } from "./types";

export interface UploadButtonProps {
  /** The user's effective plan (server side `effectivePlan()`, so BETA_PLAN counts). Unknown lets the server decide. */
  plan?: Plan | null;
  /** Where the upgrade note links. */
  pricingHref?: string;
  /** Upload endpoint (tests and previews can point it elsewhere). */
  endpoint?: string;
}

/** Decorative upload arrow; the text next to it carries the meaning. */
function IconUpload() {
  return (
    <svg className="bn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </svg>
  );
}

type Message = { kind: "error" | "info"; text: string; upgrade?: boolean } | null;

async function imageSize(file: File): Promise<{ width: number | null; height: number | null }> {
  try {
    const bmp = await createImageBitmap(file);
    const size = { width: bmp.width, height: bmp.height };
    bmp.close();
    return size;
  } catch {
    return { width: null, height: null };
  }
}

function errorText(code: unknown): string {
  return typeof code === "string" && code in UPLOAD_MESSAGES
    ? UPLOAD_MESSAGES[code as UploadErrorCode]
    : UPLOAD_MESSAGES.storage_unavailable;
}

export function UploadButton({ plan, pricingHref = "/en/pricing", endpoint = "/api/uploads" }: UploadButtonProps) {
  const rf = useReactFlow<CanvasFlowNode>();
  const actions = useCanvasActions();
  const inputId = useId();
  const noteId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const allowed = plan == null || limitsFor(plan).uploads;

  function center(): { x: number; y: number } {
    const flow = wrapRef.current?.closest(".bn-canvas")?.querySelector(".react-flow");
    const r = flow?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  async function upload(file: File) {
    const problem = checkUploadFile(file);
    if (problem) {
      setMessage({ kind: "error", text: UPLOAD_MESSAGES[problem] });
      return;
    }
    setBusy(true);
    setMessage({ kind: "info", text: `Uploading ${file.name}` });
    try {
      const size = await imageSize(file);
      const form = new FormData();
      form.append(UPLOAD_FIELD, file);
      const res = await fetch(endpoint, { method: "POST", body: form, credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (!res.ok || typeof body.url !== "string") {
        setMessage({ kind: "error", text: errorText(body.error), upgrade: body.error === "plan_required" });
        return;
      }
      const title = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 300) || "Your image";
      const box = referenceSize(size);
      const c = center();
      const node: UploadFlowNode = {
        id: newNodeId("up"),
        type: "upload",
        position: { x: Math.round(c.x - box.w / 2), y: Math.round(c.y - box.h / 2) },
        width: box.w,
        height: box.h,
        data: {
          imageUrl: body.url,
          thumbUrl: null,
          sourceUrl: body.url,
          sourceSite: "upload",
          title,
          note: null,
          tag: null,
          width: size.width,
          height: size.height,
        },
      };
      rf.addNodes(node);
      setMessage(null);
      actions.announce(`Uploaded ${title}. It is on the canvas.`);
      actions.focusNode(node.id);
    } catch {
      setMessage({ kind: "error", text: UPLOAD_MESSAGES.storage_unavailable });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bn-toolbar-group bn-upload" ref={wrapRef}>
      {allowed ? (
        <>
          <input
            id={inputId}
            className="bn-visually-hidden"
            type="file"
            accept={UPLOAD_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          <label htmlFor={inputId} className="bn-btn" aria-busy={busy}>
            <IconUpload />
            <span>{busy ? "Uploading" : "Upload image"}</span>
          </label>
        </>
      ) : (
        <button
          type="button"
          className="bn-btn"
          aria-describedby={message ? noteId : undefined}
          onClick={() => setMessage({ kind: "info", text: UPLOAD_MESSAGES.plan_required, upgrade: true })}
        >
          <IconUpload />
          <span>Upload image</span>
        </button>
      )}
      {/* Two live regions that always exist, so each message is announced (status for progress and notes, alert for errors). */}
      <span id={noteId} className="bn-upload-msg" role="status">
        {message?.kind === "info" && message.text}
        {message?.kind === "info" && message.upgrade && (
          <>
            {" "}
            <a href={pricingHref}>See plans</a>
          </>
        )}
      </span>
      <span className="bn-upload-msg bn-upload-error" role="alert">
        {message?.kind === "error" && message.text}
        {message?.kind === "error" && message.upgrade && (
          <>
            {" "}
            <a href={pricingHref}>See plans</a>
          </>
        )}
      </span>
    </div>
  );
}
