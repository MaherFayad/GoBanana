"use client";

/**
 * Canvases dashboard as a Finder window on the GoBanana desktop (docs/site-redesign-spec.md):
 * a glass sidebar with the traffic lights at its top (Canvases, Shared links, Setup guide, Give
 * feedback, Account, Sign out), a toolbar (title and count, a search over titles and briefs, an
 * Icons / List switch, New canvas), the canvases, and an Inspector at the end side.
 *
 * - The lights are a picture (aria-hidden): the dashboard is a page, not a window that closes.
 * - Collapse keeps the sidebar to its icons; the choice and the Icons / List view are remembered
 *   in localStorage (wrapped in try/catch: private windows and blocked storage use the defaults).
 * - "Show details" on a card fills the Inspector (aria-pressed, plus a ring on the card). A second
 *   click on the same card opens it. Under 768px the Inspector is a bottom sheet instead (the
 *   Studio Dialog: native <dialog>, focus trapped, Escape closes, focus returns to the button),
 *   the sidebar's two views become a segmented control, and cards become rows.
 * - Collage images are plain <img> tags pointing at each reference's own thumbnail (never
 *   proxied, stored or re-hosted); a broken one turns into a blank glass cell. A canvas with no
 *   references shows a designed tile with the Bend mark.
 * - Nothing here is draggable, so no drag alternative is needed.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useSyncExternalStore, type ReactNode, type Ref } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { Dialog } from "@/components/studio/Dialog";
import {
  AccountIcon,
  ArrowEndIcon,
  CanvasesIcon,
  ClockIcon,
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
  view: "all" | "shared";
  cards: DashCard[];
  total: number;
  sharedCount: number;
  failed: boolean;
  email: string | null;
  links: Links;
  t: Labels;
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

/** The traffic lights: a picture of a window, so hidden from assistive tech. */
function Lights() {
  return (
    <span className="dwin-lights" aria-hidden="true">
      <span className="dwin-light" data-light="close" />
      <span className="dwin-light" data-light="min" />
      <span className="dwin-light" data-light="zoom" />
    </span>
  );
}

/** One sidebar row. Collapsed, the label is visually hidden and shown as a tooltip. */
function NavRow({
  collapsed,
  label,
  icon,
  href,
  current,
  count,
}: {
  collapsed: boolean;
  label: string;
  icon: ReactNode;
  href: string;
  current?: boolean;
  count?: number;
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
  const link = href.startsWith("/docs/") || href.startsWith("mailto:") ? (
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

/** What the Inspector and the phone sheet show for one canvas. */
function Details({ card, t, withTitle, bodyRef }: { card: DashCard; t: Labels; withTitle: boolean; bodyRef?: Ref<HTMLDivElement> }) {
  return (
    <div className="lab-details-body" ref={bodyRef} tabIndex={bodyRef ? -1 : undefined}>
      <Collage card={card} label={t.collageLabel.replace("{title}", card.title)} large />
      {withTitle ? (
        <h3 className="lab-details-title" dir="auto">
          {card.title}
        </h3>
      ) : null}
      <dl className="lab-facts">
        <dt>{t.brief}</dt>
        <dd dir={card.brief ? "auto" : undefined}>{card.brief ?? t.noBrief}</dd>
        <dt>{t.updated}</dt>
        <dd>
          <time dateTime={card.updatedAt}>{card.updatedLong}</time>
          <span className="lab-muted"> ({card.updatedRelative})</span>
        </dd>
        <dt>{t.directions}</dt>
        <dd>{card.directionCount}</dd>
        <dt>{t.references}</dt>
        <dd>{card.referenceCount === 0 ? t.noRefs : card.referenceCount}</dd>
        <dt>{t.link}</dt>
        <dd>{card.shared ? t.linkOn : t.linkOff}</dd>
      </dl>
      {card.collage.length > 0 ? (
        <>
          <h4 className="lab-sources-title">{t.sources}</h4>
          <ul className="lab-sources">
            {card.collage.map((img, i) => (
              <li key={`${img.sourceUrl}-${i}`}>
                <a href={img.sourceUrl} target="_blank" rel="noopener noreferrer" dir="ltr">
                  <ExternalIcon size={12} />
                  <span>{img.sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Link className="st-btn lab-open" data-variant="primary" data-size="lg" href={`/c/${encodeURIComponent(card.id)}`}>
        {t.open}
        <ArrowEndIcon size={16} />
      </Link>
    </div>
  );
}

export function Dashboard({ locale, appName, view, cards, total, sharedCount, failed, email, links, t }: Props) {
  const collapsed = usePref(collapsedPref) === "1";
  const layout: Layout = usePref(layoutPref) === "list" ? "list" : "grid";
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(cards[0]?.id ?? null);
  // The card the user last clicked. A second click on it opens the canvas; the first one only
  // shows its details. Starts empty so the preselected first card still needs two clicks.
  const [armed, setArmed] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();
  // The sheet opens at its top (the collage), not scrolled down to its first link.
  const sheetBody = useRef<HTMLDivElement>(null);
  const newId = useId();
  const searchId = useId();
  const canvasHref = (id: string) => `/c/${encodeURIComponent(id)}`;

  const pickCard = (id: string) => {
    // On a phone the details open in a sheet, which has its own Open button.
    if (window.matchMedia(NARROW).matches) {
      setSelected(id);
      setSheetOpen(true);
      return;
    }
    if (armed === id) {
      router.push(canvasHref(id));
      return;
    }
    setSelected(id);
    setArmed(id);
  };

  const q = query.trim().toLocaleLowerCase(locale);
  const shown = q
    ? cards.filter((c) => c.title.toLocaleLowerCase(locale).includes(q) || (c.brief ?? "").toLocaleLowerCase(locale).includes(q))
    : cards;
  const current = cards.find((c) => c.id === selected) ?? null;
  const title = view === "shared" ? t.sharedTitle : t.title;
  const collapseLabel = collapsed ? t.expand : t.collapse;
  const setupLabel = fmt(t.newCta, { app: appName });

  return (
    <div className="lab dash" data-collapsed={collapsed ? "" : undefined} data-view={layout}>
      <div className="dwin dash-win">
        {/* ------------------------------------------------------------ sidebar */}
        <aside className="lab-side dash-side" aria-label={t.sidebarLabel}>
          <div className="dash-side-top">
            <Lights />
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
                <NavRow collapsed={collapsed} label={t.canvases} icon={<CanvasesIcon size={16} />} href={links.all} current={view === "all"} count={total} />
              </li>
              {sharedCount > 0 ? (
                <li>
                  <NavRow collapsed={collapsed} label={t.shared} icon={<ShareIcon size={16} />} href={links.shared} current={view === "shared"} count={sharedCount} />
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
          <div className="dash-phone-bar" aria-hidden="true">
            <Lights />
            <span className="dash-phone-title">{fmt(t.windowTitle, { app: appName })}</span>
          </div>

          <header className="lab-head dash-toolbar">
            <div className="dash-titles">
              <h1 id="lab-title">{title}</h1>
              {!failed ? (
                <p className="lab-count" role="status">
                  {t.count.replace("{n}", String(shown.length))}
                </p>
              ) : null}
            </div>
            <div className="dash-tools">
              {!failed && cards.length > 0 ? (
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
            <Link className="dash-seg-item" href={links.all} aria-current={view === "all" ? "page" : undefined}>
              {t.canvases}
              <span className="dash-seg-count" dir="ltr">
                {total}
              </span>
            </Link>
            {sharedCount > 0 ? (
              <Link className="dash-seg-item" href={links.shared} aria-current={view === "shared" ? "page" : undefined}>
                {t.shared}
                <span className="dash-seg-count" dir="ltr">
                  {sharedCount}
                </span>
              </Link>
            ) : (
              <span className="dash-seg-item" aria-disabled="true">
                {t.shared}
                <span className="dash-seg-count" dir="ltr">
                  0
                </span>
              </span>
            )}
          </nav>

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
          ) : cards.length === 0 ? (
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
                const isSel = card.id === selected;
                const titleId = `card-${card.id}`;
                return (
                  <li
                    key={card.id}
                    className="lab-card"
                    data-selected={isSel ? "" : undefined}
                    data-armed={armed === card.id ? "" : undefined}
                    // Pointer shortcut only: the title link and the details button below are the
                    // keyboard routes to the same two actions.
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      pickCard(card.id);
                    }}
                  >
                    <Collage card={card} label={t.collageLabel.replace("{title}", card.title)} />
                    <div className="lab-card-body">
                      <h2 className="lab-card-title" id={titleId}>
                        <Link href={canvasHref(card.id)} dir="auto">
                          {card.title}
                        </Link>
                      </h2>
                      {/* User text keeps its own direction (dir="auto"): a Latin brief on an Arabic page is cut at its end, not its start. */}
                      <p className="lab-card-brief" dir={card.brief ? "auto" : undefined}>
                        {card.brief ?? t.noBrief}
                      </p>
                      <p className="lab-card-meta">
                        <ClockIcon size={12} />
                        <time dateTime={card.updatedAt}>{card.updatedRelative}</time>
                      </p>
                      <dl className="lab-stats">
                        <div>
                          <dt>{t.directions}</dt>
                          <dd>{card.directionCount}</dd>
                        </div>
                        <div>
                          <dt>{t.references}</dt>
                          <dd>{card.referenceCount}</dd>
                        </div>
                      </dl>
                      {card.sites.length > 0 ? (
                        <p className="lab-card-sites">
                          <bdi>{card.sites.join(", ")}</bdi>
                        </p>
                      ) : null}
                      <div className="lab-card-foot">
                        {card.shared ? (
                          <span className="st-chip" data-tone="ship">
                            <ShareIcon size={12} />
                            <span>{t.sharedChip}</span>
                          </span>
                        ) : null}
                        {armed === card.id ? (
                          <Link
                            className="st-btn lab-details-btn"
                            data-variant="primary"
                            data-size="sm"
                            href={canvasHref(card.id)}
                            aria-describedby={titleId}
                          >
                            {t.open}
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="st-btn lab-details-btn"
                            data-variant="ghost"
                            data-size="sm"
                            aria-pressed={isSel}
                            aria-describedby={titleId}
                            onClick={() => pickCard(card.id)}
                          >
                            {t.showDetails}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ------------------------------------------------------------ Inspector */}
        <aside className="lab-details dash-inspector" aria-labelledby="details-title">
          <h2 id="details-title" className="lab-details-head">
            <InfoIcon size={16} />
            {t.detailsTitle}
          </h2>
          {current ? (
            <div aria-live="polite">
              <Details card={current} t={t} withTitle />
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
        {sheetOpen && current ? <Details card={current} t={t} withTitle={false} bodyRef={sheetBody} /> : null}
      </Dialog>
    </div>
  );
}
