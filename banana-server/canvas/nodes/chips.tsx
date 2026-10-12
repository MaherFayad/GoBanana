"use client";

import { Tooltip } from "@/components/studio/Tooltip";
import { CheckIcon, CompassIcon, ExternalIcon, ImageOffIcon, UploadIcon } from "../icons";
import { tagLabel } from "../labels";
import type { Tag } from "../types";

/**
 * Source chip (hard rule 3): site name and link, always visible on every reference.
 * A 24px pill on an opaque base, so it reads over any image; the full URL is in a Tooltip.
 * Uploads have no source page; pass `upload` to show "Your upload" with the upload glyph.
 */
export function SourceChip({ site, url, upload = false }: { site: string; url: string; upload?: boolean }) {
  return (
    <Tooltip content={url} side="top" wide>
      <a
        className="st-chip bn-source nodrag nopan"
        data-tone="neutral"
        href={url}
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {upload ? <UploadIcon size={12} /> : <ExternalIcon size={12} />}
        <span>{site}</span>
        <span className="st-visually-hidden"> (source, opens in a new tab)</span>
      </a>
    </Tooltip>
  );
}

/** Ship or Explore, shown with text and an icon, not color alone (SC 1.4.1). */
export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className={`st-chip bn-chip bn-chip-${tag}`} data-tone={tag} data-tag={tag}>
      {tag === "ship" ? <CheckIcon size={12} /> : <CompassIcon size={12} />}
      <span>{tagLabel(tag)}</span>
    </span>
  );
}

/**
 * Shown instead of a broken image: stripes, the image-off glyph, title, source site and a link.
 * `mobbin`: Mobbin image links expire after about 30 days, so the card says so and links to the
 * screen on Mobbin until the agent refreshes the image (add_to_canvas with the screenId).
 */
export function LinkCard({ title, site, url, mobbin = false }: { title?: string | null; site: string; url: string; mobbin?: boolean }) {
  return (
    <div className="bn-linkcard" data-testid="link-card" data-expired={mobbin ? "" : undefined}>
      <ImageOffIcon size={24} />
      <p className="bn-linkcard-title">{title || "Untitled reference"}</p>
      <p className="bn-linkcard-site">{site}</p>
      {mobbin && <p className="bn-linkcard-why">Image expired</p>}
      <a className="nodrag nopan" href={url} target="_blank" rel="noopener noreferrer nofollow">
        {mobbin ? "Open on Mobbin" : `View on ${site}`}
        <span className="st-visually-hidden"> (opens in a new tab)</span>
      </a>
      {!mobbin && <p className="bn-linkcard-why">The image could not load here.</p>}
    </div>
  );
}

/** Small "Art" badge on art direction references (zone "art"): the wild idea as an image, not a UI reference. */
export function ArtChip() {
  return (
    <span className="st-chip bn-chip bn-chip-art" data-tone="neutral" data-testid="art-chip">
      <span>Art</span>
      <span className="st-visually-hidden"> direction reference</span>
    </span>
  );
}
