/**
 * The canvas window's skeleton: title bar with dimmed traffic lights, rail, panel rows and the
 * board, on the shimmer bars from studio-components.css (still under reduced motion). Used by the
 * direct load (app/c/[id]/loading.tsx) and the window that opens over a page while the board loads.
 */
import type { CSSProperties } from "react";
import "./canvas.css";
import "./overlays.css";

/** Width or height of one bar, through the custom properties studio-components.css reads. */
const w = (v: string) => ({ "--st-skeleton-w": v }) as CSSProperties;
const h = (v: string) => ({ "--st-skeleton-h": v }) as CSSProperties;

const PANEL_ROWS = [72, 56, 64, 48, 60];

export function CanvasSkeletonWindow() {
  return (
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
  );
}
