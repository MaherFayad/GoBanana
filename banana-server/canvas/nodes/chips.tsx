"use client";

import { IconCheck, IconCompass, IconExternal, IconImageOff } from "../icons";
import { tagLabel } from "../labels";
import type { Tag } from "../types";

/** Source chip (hard rule 3): site name + link, always visible on every reference. */
export function SourceChip({ site, url }: { site: string; url: string }) {
  return (
    <a className="bn-source nodrag nopan" href={url} target="_blank" rel="noopener noreferrer nofollow" title={url}>
      <IconExternal />
      <span>{site}</span>
      <span className="bn-visually-hidden"> (source, opens in a new tab)</span>
    </a>
  );
}

/** Ship or Explore, shown with text and an icon, not color alone (SC 1.4.1). */
export function TagChip({ tag }: { tag: Tag }) {
  return (
    <span className={`bn-chip bn-chip-${tag}`} data-tag={tag}>
      {tag === "ship" ? <IconCheck /> : <IconCompass />}
      <span>{tagLabel(tag)}</span>
    </span>
  );
}

/** Shown instead of a broken image: title, source site and a link. */
export function LinkCard({ title, site, url }: { title?: string | null; site: string; url: string }) {
  return (
    <div className="bn-linkcard" data-testid="link-card">
      <IconImageOff />
      <p className="bn-linkcard-title">{title || "Untitled reference"}</p>
      <p className="bn-linkcard-site">{site}</p>
      <a className="nodrag nopan" href={url} target="_blank" rel="noopener noreferrer nofollow">
        View on {site}
        <span className="bn-visually-hidden"> (opens in a new tab)</span>
      </a>
      <p className="bn-linkcard-why">The image could not load here.</p>
    </div>
  );
}
