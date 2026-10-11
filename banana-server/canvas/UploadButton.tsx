"use client";

/**
 * Upload one of your own images (Pro, spec section 12) and put it on the canvas.
 *
 * A real file input with a visible label, so it works with the keyboard (Tab, then
 * Enter or Space) and with screen readers; it is the keyboard alternative to dropping a file.
 * Free users still see the control; using it shows the plan note (a toast with "See plans")
 * instead of a file picker. Only file bytes are sent: there is no "upload from URL" (hard rule 2).
 *
 * Look (docs/design-language.md section 10, "Upload button"): secondary sm button with the
 * pixel upload glyph; while busy an inline spinner and "Uploading…". Results and failures go
 * to toasts; a visually hidden status line says which file is uploading.
 */
import { useReactFlow } from "@xyflow/react";
import { useId, useRef, useState } from "react";
import { UploadIcon } from "@/components/studio/icons";
import { pushToast } from "@/components/studio/Toast";
import { limitsFor, type Plan } from "@/lib/quota";
import { checkUploadFile, UPLOAD_ACCEPT, UPLOAD_FIELD, UPLOAD_MESSAGES, type UploadErrorCode } from "@/lib/uploads/rules";
import { useCanvasActions } from "./context";
import { newNodeId, referenceSize } from "./factory";
import type { CanvasFlowNode, UploadFlowNode } from "./types";
import "./overlays.css";

export interface UploadButtonProps {
  /** The user's effective plan (server side `effectivePlan()`, so BETA_PLAN counts). Unknown lets the server decide. */
  plan?: Plan | null;
  /** Where the upgrade note links. */
  pricingHref?: string;
  /** Upload endpoint (tests and previews can point it elsewhere). */
  endpoint?: string;
}

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const allowed = plan == null || limitsFor(plan).uploads;

  function center(): { x: number; y: number } {
    const flow = wrapRef.current?.closest(".bn-canvas")?.querySelector(".react-flow");
    const r = flow?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return rf.screenToFlowPosition({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  function planNote() {
    pushToast({
      kind: "info",
      title: "Uploads are part of Pro",
      body: "Upgrade to add your own images to a canvas.",
      // A choice to act on: it stays until closed.
      duration: null,
      dedupeKey: "upload-plan",
      action: { label: "See plans", onAction: () => window.location.assign(pricingHref) },
    });
  }

  function failed(text: string) {
    pushToast({ kind: "error", title: "Could not upload the image", body: text });
  }

  async function upload(file: File) {
    const problem = checkUploadFile(file);
    if (problem) {
      failed(UPLOAD_MESSAGES[problem]);
      return;
    }
    setBusy(true);
    setProgress(`Uploading ${file.name}`);
    try {
      const size = await imageSize(file);
      const form = new FormData();
      form.append(UPLOAD_FIELD, file);
      const res = await fetch(endpoint, { method: "POST", body: form, credentials: "same-origin" });
      const body = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
      if (!res.ok || typeof body.url !== "string") {
        if (body.error === "plan_required") planNote();
        else failed(errorText(body.error));
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
      pushToast({ kind: "success", title: "Image uploaded", body: `${title} is on the canvas.` });
      actions.focusNode(node.id);
    } catch {
      failed(UPLOAD_MESSAGES.storage_unavailable);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <div className="bn-upload" ref={wrapRef}>
      {allowed ? (
        <>
          <input
            id={inputId}
            className="st-visually-hidden"
            type="file"
            accept={UPLOAD_ACCEPT}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }}
          />
          <label
            htmlFor={inputId}
            className="st-btn"
            data-variant="secondary"
            data-size="sm"
            data-loading={busy ? "inline" : undefined}
            aria-busy={busy || undefined}
          >
            {!busy && <UploadIcon size={16} />}
            <span>{busy ? "Uploading…" : "Upload image"}</span>
          </label>
        </>
      ) : (
        <button type="button" className="st-btn" data-variant="secondary" data-size="sm" onClick={planNote}>
          <UploadIcon size={16} />
          <span>Upload image</span>
        </button>
      )}
      {/* Always rendered, so the file name is read while the upload runs. */}
      <span className="st-visually-hidden" role="status">
        {progress}
      </span>
    </div>
  );
}
