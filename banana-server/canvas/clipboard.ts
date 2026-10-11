/**
 * Clipboard for the image preview. Everything happens in the user's browser, in memory:
 * no proxy, no upload, no storage (hard rule 2). "Copy image" fetches the image from its
 * host; most image CDNs refuse cross-origin reads, so on any CORS or permission failure it
 * copies the image link instead and says so.
 */

export type CopyImageResult = "image" | "link" | "failed";

/** Absolute URL, so a copied upload link ("/api/uploads/...") works outside the app. */
export function absoluteUrl(url: string, base = typeof location !== "undefined" ? location.href : "https://localhost/"): string {
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Re-encode any image blob as PNG (the one image type every clipboard accepts). */
async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
      return await canvas.convertToBlob({ type: "image/png" });
    }
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/png"),
    );
  } finally {
    bitmap.close();
  }
}

async function fetchPng(url: string): Promise<Blob> {
  const sameOrigin = typeof location !== "undefined" && new URL(url, location.href).origin === location.origin;
  const res = await fetch(url, {
    mode: "cors",
    credentials: sameOrigin ? "same-origin" : "omit",
    referrerPolicy: sameOrigin ? "same-origin" : "no-referrer",
    cache: "force-cache",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return toPng(await res.blob());
}

/** Copy the image itself; fall back to its link when the host or the browser says no. */
export async function copyImage(url: string): Promise<CopyImageResult> {
  const href = absoluteUrl(url);
  try {
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("no image clipboard");
    // Hand the clipboard a promise so the write starts inside the click (Safari needs that).
    await navigator.clipboard.write([new ClipboardItem({ "image/png": fetchPng(href) })]);
    return "image";
  } catch {
    return (await copyText(href)) ? "link" : "failed";
  }
}
