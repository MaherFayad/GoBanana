"use client";

/**
 * Canvases dashboard as a Finder window on the GoBanana desktop (docs/site-redesign-spec.md):
 * a glass sidebar with the traffic lights at its top (Canvases, Shared links, Setup guide, Give
 * feedback, Account, Sign out), a toolbar (title and count, a search over titles and briefs, an
 * Icons / List switch, New canvas), the canvases, and an Inspector at the end side.
 *
 * - The dashboard always stands in a WindowLayer (CanvasesWindow.tsx): over the page that opened
 *   it, or over the home page on a direct load. Its traffic lights (`lights`) close it, minimize
 *   it into the dock and zoom it; on phones they sit in the slim title bar.
 * - Canvases / Shared links switch on the client (history.pushState, so `?view=shared` is still
 *   a real URL and works without JavaScript): a router navigation to the same URL would be
 *   intercepted again and stack a second window over a directly loaded one.
 * - Collapse keeps the sidebar to its icons; the choice and the Icons / List view are remembered
 *   in localStorage (wrapped in try/catch: private windows and blocked storage use the defaults).
 * - A card is one button (its title, stretched over the card): a click or Enter opens the canvas.
 *   Focus (Tab) shows the card in the Inspector (aria-pressed, plus a ring on the card), which
 *   leads with Open canvas. Pointing at or focusing a card prefetches its window, and the canvas
 *   code loads once the dashboard is idle, so a click opens it without a wait. Under 768px the Inspector is a bottom sheet instead (the
 *   Studio Dialog: native <dialog>, focus trapped, Escape closes, focus returns to the button),
 *   the sidebar's two views become a segmented control, and cards become rows.
 * - Collage images are plain <img> tags pointing at each reference's own thumbnail (never
 *   proxied, stored or re-hosted); a broken one turns into a blank glass cell. A canvas with no
 *   references shows a designed tile with the Bend mark.
 * - Delete canvas sits last in the Inspector and the sheet. It opens a danger-tone confirm that
 *   names the canvas (Cancel first and focused, Escape closes), then removes the card at once and
 *   calls DELETE /api/canvas/:id; a failure puts the card back and says so in a status line.
 * - Nothing here is draggable, so no drag alternative is needed.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type MouseEvent, type ReactNode, type Ref } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Dialog } from "@/components/studio/Dialog";
import {
  AccountIcon,
  ArrowEndIcon,
  CanvasesIcon,
  CloseIcon,
  CollapseIcon,
  DocsIcon,
  ExpandIcon,
  ExternalIcon,
  FeedbackIcon,
  GridIcon,
  InfoIcon,
  ListIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  SignOutIcon,
  TrashIcon,
  CheckIcon,
  ErrorIcon,
} from "@/components/studio/icons";
import { Tooltip } from "@/components/studio/Tooltip";
import type { DashboardCard } from "@/lib/site/dashboard";
import type { Dict } from "@/lib/site/dict";
import { fmt, type Locale } from "@/lib/site/i18n";

export type DashCard = DashboardCard & { updatedRelative: string; updatedLong: string; sites: string[] };

type Labels = Dict["dashboard"] & { signOut: string; close: string };

type Links = {
  home: string;
  all: string;
  shared: string;
  docs: string;
  account: string;
  signOut: string;
  feedback: string | null;
};

type Props = {
  locale: Locale;
  appName: string;
  /** Every canvas; the view (`?view=shared`) is read from the URL here. */
  cards: DashCard[];
  failed: boolean;
  email: string | null;
  links: Links;
  t: Labels;
  /** The window's working traffic lights (FrameLights). */
  lights: ReactNode;
};

type Layout = "grid" | "list";

const NARROW = "(max-width: 767.98px)";

/**
 * A remembered choice: localStorage when it works, else memory for this page. Read through
 * useSyncExternalStore, so the server and the first client render agree (the fallback).
 */
function pref(key: string, fallback: string) {
  let memory: string | null = null;
  const listeners = new Set<() => void>();
  return {
    get(): string {
      if (memory !== null) return memory;
      try {
        return window.localStorage.getItem(key) ?? fallback;
      } catch {
        return fallback;
      }
    },
    set(value: string) {
      memory = value;
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Storage blocked: the choice lasts for this page only.
      }
      for (const l of listeners) l();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    fallback,
  };
}

const collapsedPref = pref("gobanana.dashboard.collapsed", "0");
const layoutPref = pref("gobanana.dashboard.view", "grid");

function usePref(p: ReturnType<typeof pref>): string {
  return useSyncExternalStore(p.subscribe, p.get, () => p.fallback);
}

/**
 * A plain click on a Canvases / Shared links link changes the URL in place (the Next router
 * picks it up for useSearchParams); new tab and other modified clicks keep the link.
 */
function switchView(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const to = e.currentTarget.getAttribute("href");
  if (to && to !== location.pathname + location.search) window.history.pushState(null, "", to);
}

/** One sidebar row. Collapsed, the label is visually hidden and shown as a tooltip. */
function NavRow({
  collapsed,
  label,
  icon,
  href,
  current,
  count,
  inPlace = false,
}: {
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  href: string;
  current?: boolean;
  count?: number;
  /** A view of this window (switchView), not a page. */
  inPlace?: boolean;
}) {
  const body = (
    <>
      {icon}
      <span className="lab-nav-label">{label}</span>
      {count !== undefined ? (
        <span className="lab-nav-count" dir="ltr">
          {count}
        </span>
      ) : null}
    </>
  );
  // The docs (a separate static app) and mail links skip the router.
  const link = inPlace ? (
    <a className="lab-nav-item" href={href} aria-current={current ? "page" : undefined} onClick={switchView}>
      {body}
    </a>
  ) : href.startsWith("/docs/") || href.startsWith("mailto:") ? (
    <a className="lab-nav-item" href={href}>
      {body}
    </a>
  ) : (
    <Link className="lab-nav-item" href={href} aria-current={current ? "page" : undefined}>
      {body}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={label} side="end">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

function Collage({ card, label, large = false }: { card: DashCard; label: string; large?: boolean }) {
  const [broken, setBroken] = useState<Record<number, true>>({});
  const cls = large ? "collage is-large" : "collage";
  if (card.collage.length === 0) {
    // The designed empty tile: the Bend mark on glass, in place of four blank cells.
    return (
      <div className={`${cls} is-blank`} role="img" aria-label={label}>
        <span className="collage-mark">
          <BrandMark />
        </span>
      </div>
    );
  }
  const cells = Array.from({ length: 4 }, (_, i) => card.collage[i] ?? null);
  return (
    <div className={cls} role="img" aria-label={label}>
      {cells.map((img, i) =>
        img && !broken[i] ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote thumbnails load from their own host (hard rule 2: never re-hosted or optimized through this server)
          <img
            key={i}
            src={img.src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setBroken((b) => ({ ...b, [i]: true }))}
          />
        ) : (
          <span key={i} className="collage-empty" />
        ),
      )}
    </div>
  );
}

/** What the Inspector and the phone sheet show for one canvas: Open first, then a quiet list. */
function Details({
  card,
  t,
  withTitle,
  bodyRef,
  onDelete,
}: {
  card: DashCard;
  t: Labels;
  withTitle: boolean;
  bodyRef?: Ref<HTMLDivElement>;
  onDelete: (card: DashCard) => void;
}) {
  return (
    <div className="lab-details-body" ref={bodyRef} tabIndex={bodyRef ? -1 : undefined}>
      <Link className="st-btn lab-open" data-variant="primary" data-size="md" href={`/c/${encodeURIComponent(card.id)}`}>
        {t.open}
        <ArrowEndIcon size={16} />
      </Link>
      <Collage card={card} label={t.collageLabel.replace("{title}", card.title)} large />
      <div className="lab-details-titles">
        {withTitle ? (
          <h3 className="lab-details-title">
            <bdi>{card.title}</bdi>
          </h3>
        ) : null}
        <p className="lab-details-brief" dir={card.brief ? "auto" : undefined}>
          <span className="st-visually-hidden">{t.brief}: </span>
          {card.brief ?? t.noBrief}
        </p>
      </div>
      <dl className="lab-facts">
        <div>
          <dt>{t.updated}</dt>
          <dd>
            <time dateTime={card.updatedAt}>
              {card.updatedRelative}
            </time>
          </dd>
        </div>
        <div>
          <dt>{t.directions}</dt>
          <dd>{card.directionCount}</dd>
        </div>
        <div>
          <dt>{t.references}</dt>
          <dd>{card.referenceCount}</dd>
        </div>
        <div>
          <dt>{t.link}</dt>
          <dd>{card.shared ? t.linkOn : t.linkOff}</dd>
        </div>
      </dl>
      {card.collage.length > 0 ? (
        <div className="lab-sources-wrap">
          <h4 className="lab-sources-title">{t.sources}</h4>
          <ul className="lab-sources">
            {card.collage.map((img, i) => (
              <li key={`${img.sourceUrl}-${i}`}>
                <a className="lab-source" href={img.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr">
                  <ExternalIcon size={12} />
                  <span>{img.sourceUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <button type="button" className="st-btn lab-delete" data-variant="destructive" data-size="sm" onClick={() => onDelete(card)}>
        <TrashIcon size={16} />
        {t.deleteCanvas}
      </button>
    </div>
  );
}

/** "Delete {title}?" with the canvas title isolated for mixed-direction text. */
function DeleteTitle({ template, title }: { template: string; title: string }) {
  const [before = "", after = ""] = template.split("{title}");
  return (
    <>
      {before}
      <bdi>{title}</bdi>
      {after}
    </>
  );
}

export function Dashboard({ locale, appName, cards: all, failed, email, links, t, lights }: Props) {
  const total = all.length;
  const sharedCount = all.filter((c) => c.shared).length;
  // Shared links only when there is one to show (the sidebar hides it at 0).
  const view: "all" | "shared" = useSearchParams().get("view") === "shared" && sharedCount > 0 ? "shared" : "all";
  const cards = view === "shared" ? all.filter((c) => c.shared) : all;
  const collapsed = usePref(collapsedPref) === "1";
  const layout: Layout = usePref(layoutPref) === "list" ? "list" : "grid";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(cards[0]?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();
  // The sheet opens at its top (the collage), not scrolled down to its first link.
  const sheetBody = useRef<HTMLDivElement>(null);
  const newId = useId();
  const searchId = useId();
  const canvasHref = (id: string) => `/c/${encodeURIComponent(id)}`;
  // Warm the canvas code while the dashboard is idle, so opening a canvas waits only for its data.
  useEffect(() => {
    // The `typeof window` guard keeps the canvas code out of the server build.
    const warm = () =>
      void (typeof window === "undefined" ? Promise.resolve() : Promise.all([import("@/canvas/WebCanvas"), import("@/canvas/CanvasApp")])).catch(() => {});
    const idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm, { timeout: 2000 }) : window.setTimeout(warm, 600);
    return () => (typeof window.cancelIdleCallback === "function" ? window.cancelIdleCallback(idle) : window.clearTimeout(idle));
  }, []);
  const prefetched = useRef(new Set<string>());
  const prefetch = (id: string) => {
    if (prefetched.current.has(id)) return;
    prefetched.current.add(id);
    router.prefetch(canvasHref(id));
  };
  // Delete: the confirm dialog's canvas, the ids taken out optimistically, and the outcome line.
  const [confirming, setConfirming] = useState<DashCard | null>(null);
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [deleteNote, setDeleteNote] = useState<{ ok: boolean; text: string } | null>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const live = cards.filter((c) => !removed.has(c.id));
  // Cards still in the server's list but deleted here; zero again once router.refresh() lands.
  const gone = all.filter((c) => removed.has(c.id));
  const liveTotal = Math.max(0, total - gone.length);
  const liveShared = Math.max(0, sharedCount - gone.filter((c) => c.shared).length);

  const askDelete = (card: DashCard) => {
    setDeleteNote(null);
    setConfirming(card);
  };

  const confirmDelete = async () => {
    const card = confirming;
    if (!card) return;
    setConfirming(null);
    setSheetOpen(false);
    setRemoved((prev) => new Set(prev).add(card.id));
    const next = live.find((c) => c.id !== card.id) ?? null;
    if (selected === card.id) setSelected(next?.id ?? null);
    // The Delete button that opened the dialog now belongs to another card: move focus to the heading.
    window.setTimeout(() => headingRef.current?.focus(), 0);
    try {
      const res = await fetch(`/api/canvas/${encodeURIComponent(card.id)}`, { method: "DELETE", credentials: "same-origin" });
      // 404: already gone, which is what the user asked for.
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setDeleteNote({ ok: true, text: t.deleteDone.replace("{title}", card.title) });
      router.refresh();
    } catch {
      setRemoved((prev) => {
        const n = new Set(prev);
        n.delete(card.id);
        return n;
      });
      setSelected(card.id);
      setDeleteNote({ ok: false, text: t.deleteFailed.replace("{title}", card.title) });
    }
  };

  const pickCard = (id: string) => {
    // On a phone the details open in a sheet, which has its own Open button.
    if (window.matchMedia(NARROW).matches) {
      setSelected(id);
      setSheetOpen(true);
      return;
    }
    setSelected(id);
    router.push(canvasHref(id));
  };

  const q = query.trim().toLocaleLowerCase(locale);
  const shown = q
    ? live.filter((c) => c.title.toLocaleLowerCase(locale).includes(q) || (c.brief ?? "").toLocaleLowerCase(locale).includes(q))
    : live;
  // The selected canvas, else the first one in this view (the selection may be in the other view).
  const current = live.find((c) => c.id === selected) ?? live[0] ?? null;
  const title = view === "shared" ? t.sharedTitle : t.title;
  const collapseLabel = collapsed ? t.expand : t.collapse;
  const setupLabel = fmt(t.newCta, { app: appName });

  return (
    <div className="lab dash" data-collapsed={collapsed ? "" : undefined} data-view={layout}>
      <div className="dwin dash-win">
        {/* Arabic: the lights stay at the window's top left, as macOS draws them (dashboard.css). */}
        <div className="dash-corner">{lights}</div>
        {/* ------------------------------------------------------------ sidebar */}
        <aside className="lab-side dash-side" aria-label={t.sidebarLabel}>
          <div className="dash-side-top">
            {lights}
            <Tooltip content={collapseLabel} side="end">
              <button
                type="button"
                className="st-btn dash-collapse"
                data-variant="ghost"
                data-size="sm"
                data-icon-only=""
                aria-label={collapseLabel}
                aria-expanded={!collapsed}
                onClick={() => collapsedPref.set(collapsed ? "0" : "1")}
              >
                {collapsed ? <ExpandIcon size={16} /> : <CollapseIcon size={16} />}
              </button>
            </Tooltip>
          </div>

          <nav className="lab-nav" aria-label={t.workspace}>
            <p className="lab-group" aria-hidden="true">
              {t.workspace}
            </p>
            <ul>
              <li>
                <NavRow collapsed={collapsed} label={t.canvases} icon={<CanvasesIcon size={16} />} href={links.all} current={view === "all"} count={liveTotal} inPlace />
              </li>
              {liveShared > 0 ? (
                <li>
                  <NavRow collapsed={collapsed} label={t.shared} icon={<ShareIcon size={16} />} href={links.shared} current={view === "shared"} count={liveShared} inPlace />
                </li>
              ) : null}
            </ul>
          </nav>

          <nav className="lab-nav dash-help" aria-label={t.help}>
            <p className="lab-group" aria-hidden="true">
              {t.help}
            </p>
            <ul>
              <li>
                <NavRow collapsed={collapsed} label={t.docs} icon={<DocsIcon size={16} />} href={links.docs} />
              </li>
              {links.feedback ? (
                <li>
                  <NavRow
                    collapsed={collapsed}
                    label={t.feedback}
                    icon={<FeedbackIcon size={16} />}
                    href={`mailto:${links.feedback}?subject=${encodeURIComponent(`${appName} feedback`)}`}
                  />
                </li>
              ) : null}
            </ul>
          </nav>

          <div className="lab-bottom">
            <ul>
              <li>
                <NavRow collapsed={collapsed} label={t.account} icon={<AccountIcon size={16} />} href={links.account} />
              </li>
              <li>
                <form method="post" action={links.signOut}>
                  <Tooltip content={t.signOut} side="end" disabled={!collapsed}>
                    <button type="submit" className="lab-nav-item">
                      <SignOutIcon size={16} />
                      <span className="lab-nav-label">{t.signOut}</span>
                    </button>
                  </Tooltip>
                </form>
              </li>
            </ul>
            {email && !collapsed ? (
              <p className="lab-email">
                <bdi>{email}</bdi>
              </p>
            ) : null}
          </div>
        </aside>

        {/* ------------------------------------------------------------ canvases */}
        <section className="lab-main dash-main" aria-labelledby="lab-title">
          <div className="dash-phone-bar">
            {lights}
            <span className="dash-phone-title" aria-hidden="true">
              {fmt(t.windowTitle, { app: appName })}
            </span>
          </div>

          <header className="lab-head dash-toolbar">
            <div className="dash-titles">
              <h1 id="lab-title" ref={headingRef} tabIndex={-1}>
                {title}
              </h1>
              {/* The live count stays for screen readers only. */}
              {!failed ? (
                <p className="st-visually-hidden" role="status">
                  {t.count.replace("{n}", String(shown.length))}
                </p>
              ) : null}
            </div>
            <div className="dash-tools">
              {!failed && live.length > 0 ? (
                <div className="dash-search">
                  <label className="st-visually-hidden" htmlFor={searchId}>
                    {t.searchLabel}
                  </label>
                  <SearchIcon size={16} />
                  <input
                    id={searchId}
                    className="st-input dash-search-input"
                    type="search"
                    autoComplete="off"
                    placeholder={t.searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              ) : null}
              <div className="dash-view" role="group" aria-label={t.viewLabel}>
                {(
                  [
                    ["grid", t.viewGrid, <GridIcon key="g" size={16} />],
                    ["list", t.viewList, <ListIcon key="l" size={16} />],
                  ] as const
                ).map(([value, label, icon]) => (
                  <Tooltip key={value} content={label} side="bottom">
                    <button
                      type="button"
                      className="dash-view-btn"
                      aria-label={label}
                      aria-pressed={layout === value}
                      onClick={() => layoutPref.set(value)}
                    >
                      {icon}
                    </button>
                  </Tooltip>
                ))}
              </div>
              <button
                type="button"
                className="st-btn dash-new"
                data-variant="secondary"
                data-size="md"
                aria-expanded={showNew}
                aria-controls={newId}
                onClick={() => setShowNew((v) => !v)}
              >
                <PlusIcon size={16} />
                {t.newCanvas}
              </button>
            </div>
          </header>

          {/* Phones: the sidebar's two views as a segmented control. */}
          <nav className="dash-seg" aria-label={t.showLabel}>
            <a className="dash-seg-item" href={links.all} aria-current={view === "all" ? "page" : undefined} onClick={switchView}>
              {t.canvases}
              <span className="dash-seg-count" dir="ltr">
                {liveTotal}
              </span>
            </a>
            {liveShared > 0 ? (
              <a className="dash-seg-item" href={links.shared} aria-current={view === "shared" ? "page" : undefined} onClick={switchView}>
                {t.shared}
                <span className="dash-seg-count" dir="ltr">
                  {liveShared}
                </span>
              </a>
            ) : (
              <span className="dash-seg-item" aria-disabled="true">
                {t.shared}
                <span className="dash-seg-count" dir="ltr">
                  0
                </span>
              </span>
            )}
          </nav>

          {/* Delete outcome. Always rendered, so the live region exists before it fills. */}
          <div role="status" className="dash-delete-note">
            {deleteNote ? (
              <p className="st-alert" data-tone={deleteNote.ok ? "success" : "danger"}>
                <span className="st-alert-icon">{deleteNote.ok ? <CheckIcon size={16} /> : <ErrorIcon size={16} />}</span>
                <span className="st-alert-content">
                  <bdi>{deleteNote.text}</bdi>
                </span>
              </p>
            ) : null}
          </div>

          <div id={newId} className="lab-new st-alert" data-tone="info" hidden={!showNew}>
            <span className="st-alert-icon">
              <InfoIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p className="st-alert-title">{t.newTitle}</p>
              <p>{t.newBody}</p>
              <p>
                <a href={links.docs}>{setupLabel}</a>
              </p>
            </div>
          </div>

          {failed ? (
            <div className="st-empty lab-empty dash-empty" data-variant="centered" role="alert">
              <p className="st-empty-title">{t.loadFailed}</p>
              <div className="st-empty-actions">
                <a className="st-btn" data-variant="secondary" data-size="md" href={view === "shared" ? links.shared : links.all}>
                  {t.retry}
                </a>
              </div>
            </div>
          ) : live.length === 0 ? (
            <div className="st-empty lab-empty dash-empty" data-variant="centered">
              <span className="dash-empty-tile" aria-hidden="true">
                <BrandMark />
              </span>
              <h2 className="st-empty-title">{t.emptyTitle}</h2>
              <p className="st-empty-body">{fmt(t.emptyBody, { app: appName })}</p>
              <p className="st-empty-body">{t.newBody}</p>
              <div className="st-empty-actions">
                <a className="st-btn" data-variant="primary" data-size="md" href={links.docs}>
                  {setupLabel}
                </a>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="st-empty lab-empty dash-empty" data-variant="centered">
              <SearchIcon size={24} />
              <h2 className="st-empty-title">{t.noMatchTitle.replace("{q}", query.trim())}</h2>
              <p className="st-empty-body">{t.noMatchBody}</p>
              <div className="st-empty-actions">
                <button type="button" className="st-btn" data-variant="secondary" data-size="md" onClick={() => setQuery("")}>
                  <CloseIcon size={16} />
                  {t.clearSearch}
                </button>
              </div>
            </div>
          ) : (
            <ul className="lab-grid" aria-label={t.listLabel}>
              {shown.map((card) => {
                const isSel = card.id === current?.id;
                const refs =
                  card.referenceCount === 0
                    ? t.noRefs
                    : card.referenceCount === 1
                      ? t.refCountOne
                      : t.refCount.replace("{n}", String(card.referenceCount));
                return (
                  // The whole card is the title button's hit area (a stretched ::after): a click or
                  // Enter opens the canvas; focus shows it in the Inspector.
                  <li key={card.id} className="lab-card" data-selected={isSel ? "" : undefined} data-window-origin={`canvas:${card.id}`}>
                    <div className="lab-card-art">
                      <Collage card={card} label={t.collageLabel.replace("{title}", card.title)} />
                      {card.shared ? (
                        <span className="lab-card-badge">
                          <ShareIcon size={12} />
                          <span className="st-visually-hidden">{t.sharedChip}</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="lab-card-body">
                      <h2 className="lab-card-title">
                        <button
                          type="button"
                          className="lab-card-hit"
                          aria-pressed={isSel}
                          onClick={() => pickCard(card.id)}
                          onFocus={() => {
                            setSelected(card.id);
                            prefetch(card.id);
                          }}
                          onPointerEnter={() => prefetch(card.id)}
                        >
                          <bdi>{card.title}</bdi>
                        </button>
                      </h2>
                      <p className="lab-card-meta">
                        <span>{refs}</span>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={card.updatedAt}>{card.updatedRelative}</time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------------------ Inspector */}
        <aside className="lab-details dash-inspector" aria-labelledby="details-title">
          <h2 id="details-title" className="st-visually-hidden">
            {t.detailsTitle}
          </h2>
          {current ? (
            <div aria-live="polite">
              <Details card={current} t={t} withTitle onDelete={askDelete} />
            </div>
          ) : (
            <p className="lab-details-none">{t.detailsNone}</p>
          )}
        </aside>
      </div>

      {/* Phones: the Inspector as a bottom sheet. */}
      <Dialog
        open={sheetOpen && current !== null}
        onClose={() => setSheetOpen(false)}
        eyebrow={t.detailsTitle}
        title={current ? <span dir="auto">{current.title}</span> : t.detailsTitle}
        closeLabel={t.close}
        className="dash-sheet"
        initialFocus={sheetBody}
      >
        {sheetOpen && current ? <Details card={current} t={t} withTitle={false} bodyRef={sheetBody} onDelete={askDelete} /> : null}
      </Dialog>

      {/* Delete confirm: danger tone (role="alertdialog"), Cancel first and focused, Escape closes. */}
      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        tone="danger"
        size="sm"
        eyebrow={t.deleteCanvas}
        title={confirming ? <DeleteTitle template={t.deleteTitle} title={confirming.title} /> : t.deleteCanvas}
        closeLabel={t.close}
        initialFocus={cancelDeleteRef}
        footer={
          <>
            <button ref={cancelDeleteRef} type="button" className="st-btn" data-variant="secondary" data-size="lg" onClick={() => setConfirming(null)}>
              {t.deleteCancel}
            </button>
            <button type="button" className="st-btn" data-variant="destructive" data-size="lg" onClick={confirmDelete}>
              {t.deleteCanvas}
            </button>
          </>
        }
      >
        <p>{t.deleteBody}</p>
        <p>{t.deleteUploads}</p>
      </Dialog>
    </div>
  );
}
