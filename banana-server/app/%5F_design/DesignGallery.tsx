"use client";

import { useId, useState } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { Kbd, ShortcutKeys } from "@/components/studio/Kbd";
import { ToastProvider, pushToast } from "@/components/studio/Toast";
import { Tooltip } from "@/components/studio/Tooltip";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronEndIcon,
  ChevronStartIcon,
  ChevronUpIcon,
  CloseIcon,
  CompassIcon,
  ErrorIcon,
  ExternalIcon,
  FitIcon,
  FrameIcon,
  HandIcon,
  HelpIcon,
  ImageOffIcon,
  InfoIcon,
  LinkIcon,
  MinusIcon,
  MoreIcon,
  NoteIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  UploadIcon,
  WarningIcon,
  type IconComponent,
} from "@/components/studio/icons";

export type GalleryTheme = "light" | "dark";
export type GalleryDir = "ltr" | "rtl";

const ICONS: [string, IconComponent][] = [
  ["external", ExternalIcon],
  ["check", CheckIcon],
  ["compass", CompassIcon],
  ["close", CloseIcon],
  ["more", MoreIcon],
  ["chevron down", ChevronDownIcon],
  ["chevron up", ChevronUpIcon],
  ["chevron end", ChevronEndIcon],
  ["chevron start", ChevronStartIcon],
  ["plus", PlusIcon],
  ["minus", MinusIcon],
  ["fit", FitIcon],
  ["panel", PanelIcon],
  ["note", NoteIcon],
  ["frame", FrameIcon],
  ["image off", ImageOffIcon],
  ["warning", WarningIcon],
  ["upload", UploadIcon],
  ["share", ShareIcon],
  ["link", LinkIcon],
  ["hand", HandIcon],
  ["help", HelpIcon],
  ["search", SearchIcon],
  ["info", InfoIcon],
  ["error", ErrorIcon],
];

const COMBOS: { theme: GalleryTheme; dir: GalleryDir }[] = [
  { theme: "light", dir: "ltr" },
  { theme: "dark", dir: "ltr" },
  { theme: "light", dir: "rtl" },
  { theme: "dark", dir: "rtl" },
];

export function DesignGallery({ theme, dir }: { theme?: GalleryTheme; dir?: GalleryDir }) {
  const combos = COMBOS.filter((c) => (!theme || c.theme === theme) && (!dir || c.dir === dir));
  return (
    <ToastProvider>
      <main className="design-root">
        {combos.map((c) => (
          <Panel key={`${c.theme}-${c.dir}`} theme={c.theme} dir={c.dir} />
        ))}
      </main>
    </ToastProvider>
  );
}

function Panel({ theme, dir }: { theme: GalleryTheme; dir: GalleryDir }) {
  const uid = useId();
  const [dialog, setDialog] = useState<"none" | "default" | "danger">("none");
  const [pressed, setPressed] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const label = `${theme}, ${dir === "rtl" ? "right to left" : "left to right"}`;
  const id = (name: string) => `${uid}-${name}`;

  return (
    <section
      className="design-panel"
      data-theme={theme}
      dir={dir}
      lang="en"
      aria-labelledby={id("h")}
      data-testid={`panel-${theme}-${dir}`}
    >
      <h1 id={id("h")}>
        {dir === "rtl" && (
          <>
            <span lang="ar">عناصر الواجهة</span>{" "}
          </>
        )}
        Studio primitives ({label})
      </h1>

      <div>
        <h2>Buttons</h2>
        <div className="design-surface">
          {(["xs", "sm", "md", "lg"] as const).map((size) => (
            <div className="design-row" key={size}>
              <button type="button" className="st-btn" data-variant="primary" data-size={size}>
                Create canvas
              </button>
              <button type="button" className="st-btn" data-variant="secondary" data-size={size}>
                Copy link
              </button>
              <button type="button" className="st-btn" data-variant="ghost" data-size={size}>
                Arrange
              </button>
              <button type="button" className="st-btn" data-variant="destructive" data-size={size}>
                Delete canvas
              </button>
              <Tooltip content="Zoom in">
                <button type="button" className="st-btn" data-variant="ghost" data-size={size} data-icon-only="" aria-label="Zoom in">
                  <PlusIcon size={size === "lg" ? 24 : 16} />
                </button>
              </Tooltip>
            </div>
          ))}
          <div className="design-row">
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              aria-pressed={pressed}
              data-testid="toggle"
              onClick={() => setPressed((p) => !p)}
            >
              <HandIcon size={16} />
              Hand tool
            </button>
            <button type="button" className="st-btn" data-variant="ghost" data-tone="danger">
              Turn off link
            </button>
            <button type="button" className="st-btn" data-variant="primary" disabled>
              Save
            </button>
            <Tooltip content="Sign in to share a canvas.">
              <button type="button" className="st-btn" data-variant="secondary" aria-disabled="true">
                Share
              </button>
            </Tooltip>
            <button type="button" className="st-btn" data-variant="primary" data-loading="" aria-busy="true" aria-label="Saving…">
              Save
            </button>
            <button type="button" className="st-btn" data-variant="secondary" data-loading="inline" aria-busy="true">
              Uploading…
            </button>
            <a className="st-btn" data-variant="secondary" href="#top">
              Open on the web
              <ExternalIcon size={12} />
            </a>
          </div>
        </div>
      </div>

      <div>
        <h2>Icons</h2>
        <div className="design-surface">
          <div className="design-row">
            {ICONS.map(([name, Icon]) => (
              <span className="design-icon-cell" key={name}>
                <span className="design-row">
                  <Icon size={12} />
                  <Icon size={16} />
                  <Icon size={24} />
                </span>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2>Inputs</h2>
        <div className="design-surface">
          <div className="design-field">
            <label htmlFor={id("title")}>Canvas title</label>
            <input id={id("title")} className="st-input" placeholder="Untitled canvas" />
          </div>
          <div className="design-field">
            <label htmlFor={id("url")}>Page address</label>
            <input
              id={id("url")}
              className="st-input"
              data-size="md"
              aria-invalid="true"
              aria-describedby={id("url-error")}
              defaultValue="example"
            />
            <p className="design-field-error" id={id("url-error")} role="alert">
              Enter a full address, starting with https://
            </p>
          </div>
          <div className="design-field">
            <label htmlFor={id("site")}>Site field</label>
            <input id={id("site")} className="st-input" data-size="lg" />
          </div>
          <div className="design-field">
            <label htmlFor={id("off")}>Locked field</label>
            <input id={id("off")} className="st-input" data-size="xs" disabled defaultValue="Read only" />
          </div>
          <div className="design-field">
            <label htmlFor={id("note")}>Note</label>
            <textarea id={id("note")} className="st-input" data-autogrow="" rows={2} />
          </div>
        </div>
      </div>

      <div>
        <h2>Menu</h2>
        <div className="design-menu-demo">
          <div className="st-menu" role="menu" aria-label="Node actions">
            <button type="button" role="menuitem" className="st-menu-item">
              <span className="st-menu-item-icon">
                <NoteIcon size={16} />
              </span>
              Add a note
              <span className="st-menu-item-end">
                <ShortcutKeys keys="N" />
              </span>
            </button>
            <button type="button" role="menuitemradio" aria-checked="true" className="st-menu-item">
              <span className="st-menu-item-icon">
                <CheckIcon size={16} className="st-menu-item-check" />
              </span>
              Fit to content
            </button>
            <hr className="st-menu-sep" />
            <button type="button" role="menuitem" className="st-menu-item" data-tone="danger">
              <span className="st-menu-item-icon">
                <CloseIcon size={16} />
              </span>
              Remove from canvas
            </button>
          </div>
        </div>
      </div>

      <div>
        <h2>Dialog and toasts</h2>
        <div className="design-surface">
          <div className="design-row">
            <button type="button" className="st-btn" data-variant="secondary" onClick={() => setDialog("default")}>
              Share canvas
            </button>
            <button type="button" className="st-btn" data-variant="destructive" onClick={() => setDialog("danger")}>
              Delete account
            </button>
            <button type="button" className="st-btn" data-variant="secondary" onClick={() => pushToast({ kind: "success", title: "Link copied" })}>
              Success toast
            </button>
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              onClick={() => pushToast({ kind: "info", title: "Canvas arranged", body: "12 items moved into a grid." })}
            >
              Info toast
            </button>
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              onClick={() => pushToast({ kind: "warning", title: "Large image", body: "This file is close to the 10 MB limit." })}
            >
              Warning toast
            </button>
            <button
              type="button"
              className="st-btn"
              data-variant="secondary"
              onClick={() =>
                pushToast({
                  kind: "error",
                  title: "Could not save",
                  body: "The server did not answer. Your changes are kept in this tab.",
                  action: { label: "Try again", onAction: () => pushToast({ kind: "info", title: "Saving again" }) },
                })
              }
            >
              Error toast
            </button>
          </div>
          <Dialog
            open={dialog === "default"}
            onClose={() => setDialog("none")}
            title="Share canvas"
            footer={
              <>
                <button type="button" className="st-btn" data-variant="secondary" onClick={() => setDialog("none")}>
                  Cancel
                </button>
                <button type="button" className="st-btn" data-variant="primary" onClick={() => setDialog("none")}>
                  Create view link
                </button>
              </>
            }
          >
            <p>Anyone with this link can view this canvas. They cannot change it.</p>
          </Dialog>
          <Dialog
            open={dialog === "danger"}
            onClose={() => setDialog("none")}
            tone="danger"
            size="sm"
            eyebrow="Delete account"
            title="Delete your account?"
            footer={
              <>
                <button type="button" className="st-btn" data-variant="secondary" onClick={() => setDialog("none")}>
                  Cancel
                </button>
                <button type="button" className="st-btn" data-variant="destructive" onClick={() => setDialog("none")}>
                  Delete account
                </button>
              </>
            }
          >
            <p>Your canvases, uploads and share links are deleted. Your sign-in stays with the identity provider.</p>
          </Dialog>
        </div>
      </div>

      <div>
        <h2>Keycaps</h2>
        <div className="design-surface">
          <div className="design-row">
            <Kbd>Esc</Kbd>
            <ShortcutKeys keys="Mod+Shift+P" />
            <ShortcutKeys keys="Shift+1" />
            <ShortcutKeys keys="?" />
          </div>
        </div>
      </div>

      <div>
        <h2>Chips, tiles and sections</h2>
        <div className="design-surface">
          <div className="design-row">
            <span className="st-chip" data-tone="ship">
              <CheckIcon size={12} />
              <span>Ship</span>
            </span>
            <span className="st-chip" data-tone="explore">
              <CompassIcon size={12} />
              <span>Explore</span>
            </span>
            <span className="st-chip" data-tone="success">
              <CheckIcon size={12} />
              <span>AA</span>
            </span>
            <span className="st-chip" data-tone="danger">
              <CloseIcon size={12} />
              <span>Fails</span>
            </span>
            <span className="st-chip" data-tone="neutral">
              <span>3 items</span>
            </span>
            <a className="st-chip" href="#top">
              <ExternalIcon size={12} />
              <span>example.com</span>
            </a>
          </div>
          <div className="st-tile-grid">
            <div className="st-tile" data-accent="1">
              <p className="st-tile-title">Step 1</p>
              <p className="design-text">Install the connector in your agent.</p>
            </div>
            <div className="st-tile" data-accent="2">
              <p className="st-tile-title">Step 2</p>
              <p className="design-text">Ask for references.</p>
            </div>
            <button type="button" className="st-tile" data-accent="3">
              <span className="st-tile-title">Step 3</span>
              <span className="design-text">Open the canvas.</span>
            </button>
          </div>
          <div className="st-section">
            <div className="st-section-header">
              <button
                type="button"
                className="st-section-toggle"
                aria-expanded={expanded}
                aria-controls={id("section")}
                onClick={() => setExpanded((e) => !e)}
              >
                <ChevronDownIcon size={16} />
                <span className="st-section-title">Search results</span>
              </button>
            </div>
            <div className="st-section-body" id={id("section")} hidden={!expanded}>
              <p className="design-text">Results show up here.</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2>Alerts, skeletons and empty states</h2>
        <div className="design-surface">
          <div className="st-alert" data-tone="info">
            <span className="st-alert-icon">
              <InfoIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p>View only. You cannot change this canvas.</p>
            </div>
          </div>
          <div className="st-alert" data-tone="success">
            <span className="st-alert-icon">
              <CheckIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p className="st-alert-title">Request sent</p>
              <p>The owner reviews takedown requests within 7 days.</p>
            </div>
          </div>
          <div className="st-alert" data-tone="warning">
            <span className="st-alert-icon">
              <WarningIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p>Draft. This page is not final.</p>
            </div>
          </div>
          <div className="st-alert" data-tone="danger">
            <span className="st-alert-icon">
              <ErrorIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p className="st-alert-title">Fix 2 fields</p>
              <p>
                The address is missing. <a href="#top">Go to the field</a>
              </p>
            </div>
          </div>
          <div className="st-skeleton-stack" aria-busy="true">
            <span className="st-visually-hidden">Loading results</span>
            <span className="st-skeleton" data-shape="block" />
            <span className="st-skeleton" data-shape="text" />
            <span className="st-skeleton" data-shape="text" />
          </div>
          <div className="st-empty" data-variant="card">
            <p className="st-empty-title">No share links yet.</p>
            <p className="st-empty-body">Create a view link to show this canvas to someone.</p>
          </div>
          <div className="design-empty-host">
            <div className="st-empty" data-variant="centered">
              <ImageOffIcon size={24} />
              <p className="st-empty-title">No results yet.</p>
              <p className="st-empty-body">Ask your agent to search for references. Results show up here.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
