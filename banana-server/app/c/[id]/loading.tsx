/**
 * Loading state for /c/:id (plan WP-C step 6): a skeleton of the canvas window on the desk,
 * shown while the server loads the board. Title bar with dimmed traffic lights, rail, panel rows
 * and the board on its inset rounded corner, all on the shimmer bars from
 * studio-components.css (still under reduced motion). The region carries aria-busy and a
 * status line for screen readers.
 */
import type { CSSProperties } from "react";
import "@/canvas/canvas.css";
import "@/canvas/overlays.css";

/** Width or height of one bar, through the custom properties studio-components.css reads. */
const w = (v: string) => ({ "--st-skeleton-w": v }) as CSSProperties;
const h = (v: string) => ({ "--st-skeleton-h": v }) as CSSProperties;

const PANEL_ROWS = [72, 56, 64, 48, 60];

export default function CanvasLoading() {
  return (
    <div className="bn-skel" aria-busy="true">
      <p className="st-visually-hidden" role="status">
        Loading canvas
      </p>
      <div className="bn-skel-window">
        <div className="bn-skel-bar" aria-hidden="true">
          <span className="bn-lights">
            <span className="bn-light" data-light="close" />
            <span className="bn-light" data-light="min" />
            <span className="bn-light" data-light="zoom" />
          </span>
          <span className="st-skeleton" style={w("120px")} />
          <span className="st-skeleton" style={w("72px")} />
          <span className="bn-skel-spacer" />
          <span className="st-skeleton" style={w("96px")} />
          <span className="st-skeleton" style={w("64px")} />
        </div>
        <div className="bn-skel-body" aria-hidden="true">
          <div className="bn-skel-rail">
            <span className="st-skeleton" data-shape="block" />
            <span className="st-skeleton" data-shape="block" />
          </div>
          <div className="bn-skel-panel">
            <span className="st-skeleton" style={w("60%")} />
            {PANEL_ROWS.map((px, i) => (
              <span key={i} className="st-skeleton" data-shape="block" style={h(`${px}px`)} />
            ))}
          </div>
          <div className="bn-skel-board" />
        </div>
      </div>
    </div>
  );
}
