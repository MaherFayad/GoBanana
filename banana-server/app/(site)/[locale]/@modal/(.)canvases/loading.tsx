/**
 * /en/canvases opened from a site page, while the server loads the list: the Finder window opens
 * at once with a skeleton of the sidebar and cards, and the real window takes over in place
 * (WindowShell).
 */
import type { CSSProperties } from "react";
import { WindowShell } from "@/components/window/WindowShell";

const w = (v: string) => ({ "--st-skeleton-w": v }) as CSSProperties;

export default function CanvasesWindowLoading() {
  return (
    <WindowShell kind="finder" labels={{ en: "Loading your canvases", ar: "جار تحميل لوحاتك" }} closeTo="home">
      <div className="wl-skel-finder" aria-hidden="true">
        <div className="wl-skel-side">
          <span className="wl-skel-lights">
            <span />
            <span />
            <span />
          </span>
          <span className="st-skeleton" style={w("70%")} />
          <span className="st-skeleton" style={w("85%")} />
          <span className="st-skeleton" style={w("60%")} />
        </div>
        <div className="wl-skel-main">
          <span className="st-skeleton" style={w("30%")} />
          <div className="wl-skel-cards">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="st-skeleton" data-shape="block" />
            ))}
          </div>
        </div>
      </div>
    </WindowShell>
  );
}
