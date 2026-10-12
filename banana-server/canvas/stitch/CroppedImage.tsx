"use client";

/**
 * A part's crop of its hotlinked image, with CSS only (canvas/stitch/crop.ts). The image loads
 * from its source host with no referrer; nothing is fetched in JS or stored. The natural size is
 * measured on load (it wins over a stored size, which can belong to another variant) and kept in
 * memory for this tab only. In a row next to a taller part, the crop covers the stretched box.
 */
import { memo, useState } from "react";
import type { Crop } from "@/lib/stitch/types";
import { cropStyles, displaySrc, imageAspectOf } from "./crop";

/** Natural aspect per image URL, measured in this tab. Memory only, never saved. */
const measured = new Map<string, number>();

export interface CroppedImageProps {
  src: string;
  crop: Crop;
  alt: string;
  width?: number;
  height?: number;
  /** Aspect to use until the image is measured. */
  fallbackAspect: number;
  filter?: string;
  className?: string;
}

/** Memoized: a page re-renders on chrome changes under zoom, its crops only when their props change. */
export const CroppedImage = memo(function CroppedImage({ src, crop, alt, width, height, fallbackAspect, filter, className }: CroppedImageProps) {
  const [aspect, setAspect] = useState<number | null>(() => measured.get(src) ?? null);
  // The CDN's large size first; when that fails, the original as stored.
  const sources = [displaySrc(src), src].filter((u, i, all) => all.indexOf(u) === i);
  const [attempt, setAttempt] = useState(0);
  const failed = attempt >= sources.length;
  const s = cropStyles(crop, aspect ?? imageAspectOf(width, height) ?? fallbackAspect);
  return (
    <div className={`bn-crop ${className ?? ""}`} style={{ ...s.box, filter }} data-failed={failed ? "" : undefined}>
      {failed ? (
        <span className="bn-crop-missing">Image not available</span>
      ) : (
        <div className="bn-crop-fit" style={s.fit}>
        {/* eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose */}
        <img
          src={sources[attempt]}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          draggable={false}
          style={s.img}
          onLoad={(e) => {
            const a = imageAspectOf(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
            if (!a) return;
            measured.set(src, a);
            setAspect(a);
          }}
          onError={() => setAttempt((n) => n + 1)}
        />
        </div>
      )}
    </div>
  );
});
