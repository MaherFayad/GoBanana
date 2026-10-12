"use client";

/**
 * A part's crop of its hotlinked image, with CSS only (canvas/stitch/crop.ts). The image loads
 * from its source host with no referrer; nothing is fetched in JS or stored. When the part has
 * no known size, the natural size is measured on load and kept in memory for this tab only.
 */
import { useState } from "react";
import type { Crop } from "@/lib/stitch/types";
import { cropStyles, imageAspectOf } from "./crop";

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

export function CroppedImage({ src, crop, alt, width, height, fallbackAspect, filter, className }: CroppedImageProps) {
  const [aspect, setAspect] = useState<number | null>(() => imageAspectOf(width, height) ?? measured.get(src) ?? null);
  const [failed, setFailed] = useState(false);
  const known = imageAspectOf(width, height) ?? aspect;
  const s = cropStyles(crop, known ?? fallbackAspect);
  return (
    <div className={`bn-crop ${className ?? ""}`} style={{ ...s.box, filter }} data-failed={failed ? "" : undefined}>
      {failed ? (
        <span className="bn-crop-missing">Image not available</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- third-party image loaded from its source host on purpose
        <img
          src={src}
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
            if (!imageAspectOf(width, height)) setAspect(a);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
