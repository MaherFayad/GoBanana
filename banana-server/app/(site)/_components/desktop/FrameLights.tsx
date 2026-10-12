"use client";

/**
 * Working traffic lights for a site window that stands in a WindowLayer (account settings over a
 * page): red closes, yellow minimizes into the dock, green zooms to fill the screen
 * (aria-pressed). 12px lights with 24px targets, 24px apart (SC 2.5.8), as in desktop.css.
 */
import { useWindowFrame } from "@/components/window/frame";
import { fmt } from "@/lib/site/i18n";

export type FrameLightLabels = { close: string; minimise: string; zoom: string };

export function FrameLights({ title, labels }: { title: string; labels: FrameLightLabels }) {
  const frame = useWindowFrame();
  if (!frame) return null;
  const name = (template: string) => fmt(template, { title });
  return (
    <span className="dwin-lights">
      <button type="button" className="dwin-light" data-light="close" aria-label={name(labels.close)} onClick={frame.close} />
      <button type="button" className="dwin-light" data-light="min" aria-label={name(labels.minimise)} onClick={frame.minimize} />
      <button
        type="button"
        className="dwin-light"
        data-light="zoom"
        aria-label={name(labels.zoom)}
        aria-pressed={frame.zoomed}
        onClick={frame.toggleZoom}
      />
    </span>
  );
}
