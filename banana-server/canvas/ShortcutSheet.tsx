"use client";

/**
 * The shortcut sheet (? key, or the help button in the top bar). It reads the same registry
 * as the key handlers (canvas/shortcuts.ts), grouped by where each shortcut works.
 */
import { Dialog } from "@/components/studio/Dialog";
import { ShortcutKeys } from "@/components/studio/Kbd";
import { SCOPE_TITLES, SHORTCUTS, type ShortcutScope } from "./shortcuts";

const ORDER: ShortcutScope[] = ["canvas", "board", "item", "results"];

export function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" eyebrow="Help" size="lg" className="bn-sheet">
      {/* Focusable so the list can scroll with the keyboard. */}
      <div tabIndex={0} role="group" aria-label="Shortcut list">
        <p className="bn-sheet-intro">
          Tab moves between items and their controls. Every drag on the canvas also has a key or a menu item.
        </p>
        {ORDER.map((scope) => (
          <section key={scope} className="bn-sheet-group" aria-labelledby={`bn-sheet-${scope}`}>
            <h3 id={`bn-sheet-${scope}`}>{SCOPE_TITLES[scope]}</h3>
            <dl>
              {SHORTCUTS.filter((s) => s.scope === scope).map((s) => (
                <div key={s.id} className="bn-sheet-row">
                  <dt>{s.label}</dt>
                  <dd>
                    {s.keys.map((k, i) => (
                      <span key={k} className="bn-sheet-keys">
                        {i > 0 && <span className="bn-sheet-or">or</span>}
                        <ShortcutKeys keys={k} />
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
