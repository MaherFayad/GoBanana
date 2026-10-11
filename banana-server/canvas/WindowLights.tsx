"use client";

/**
 * Traffic lights at the start of the canvas window's title bar (the GoBanana desktop look,
 * DECISIONS 2026-10-12). Only lights that do something are controls (SC 4.1.2):
 * - red: a link back to the canvases dashboard (`closeHref`, web canvas only);
 * - green: full screen on and off, where the browser allows it (not on iPhone Safari);
 * - yellow, and any light without an action (the shared canvas): a picture, hidden from
 *   assistive tech and drawn dimmed so it does not look clickable.
 * Each light is 12px with a 24px target, centres 24px apart (SC 2.5.8). The lights are always on
 * the inline start, so they sit on the right in Arabic, like the rest of the bar.
 */
import { useCallback, useSyncExternalStore } from "react";
import { Tooltip } from "@/components/studio/Tooltip";

export interface WindowLightsProps {
  /** Where the red light goes. Leave unset for a read-only window (the shared canvas). */
  closeHref?: string;
  closeLabel?: string;
}

const onFullscreenChange = (cb: () => void) => {
  document.addEventListener("fullscreenchange", cb);
  return () => document.removeEventListener("fullscreenchange", cb);
};

function useFullscreen(): { supported: boolean; active: boolean } {
  const supported = useSyncExternalStore(
    onFullscreenChange,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  );
  const active = useSyncExternalStore(
    onFullscreenChange,
    () => document.fullscreenElement !== null,
    () => false,
  );
  return { supported, active };
}

export function WindowLights({ closeHref, closeLabel = "Close canvas, back to your canvases" }: WindowLightsProps) {
  const full = useFullscreen();
  const interactive = Boolean(closeHref) || full.supported;

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void document.documentElement.requestFullscreen().catch(() => {});
  }, []);

  return (
    <span className="bn-lights" aria-hidden={interactive ? undefined : true} data-testid="window-lights">
      {closeHref ? (
        <Tooltip content="Back to your canvases">
          <a className="bn-light" data-light="close" href={closeHref} aria-label={closeLabel} />
        </Tooltip>
      ) : (
        <span className="bn-light" data-light="close" data-inert="" aria-hidden="true" />
      )}
      <span className="bn-light" data-light="min" data-inert="" aria-hidden="true" />
      {full.supported ? (
        <Tooltip content={full.active ? "Exit full screen" : "Full screen"}>
          <button type="button" className="bn-light" data-light="zoom" aria-label="Full screen" aria-pressed={full.active} onClick={toggleFullscreen} />
        </Tooltip>
      ) : (
        <span className="bn-light" data-light="zoom" data-inert="" aria-hidden="true" />
      )}
    </span>
  );
}
