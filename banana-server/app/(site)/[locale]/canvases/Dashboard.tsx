"use client";

/**
 * Canvases dashboard shell, in the structure of pryzm.design's "Lab": a slim start sidebar
 * (logo, a "Workspace" group, then Docs, Give feedback, Collapse, Account and Sign out at the
 * bottom) and rounded panels: the canvas grid, and a details panel at the end side.
 *
 * - Collapse keeps the sidebar to its icons; the choice is remembered in localStorage (wrapped
 *   in try/catch: private windows and blocked storage just start expanded).
 * - "Show details" on a card fills the details panel (aria-pressed, plus a ring on the card).
 * - Collage images are plain <img> tags pointing at each reference's own thumbnail (never
 *   proxied, stored or re-hosted); a broken one turns into the stripe placeholder. Their source
 *   sites show on the card and their links in the details panel.
 * - Nothing here is draggable, so no drag alternative is needed.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  AccountIcon,
  ArrowEndIcon,
  CanvasesIcon,
  ClockIcon,
  CollapseIcon,
  DocsIcon,
  ExpandIcon,
  ExternalIcon,
  FeedbackIcon,
  InfoIcon,
  PlusIcon,
  ShareIcon,
  SignOutIcon,
} from "@/components/studio/icons";
import { Tooltip } from "@/components/studio/Tooltip";
import type { DashboardCard } from "@/lib/site/dashboard";
import type { Dict } from "@/lib/site/dict";
import type { Locale } from "@/lib/site/i18n";

export type DashCard = DashboardCard & { updatedRelative: string; updatedLong: string; sites: string[] };

type Labels = Dict["dashboard"] & { signOut: string };

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

const COLLAPSE_KEY = "gobanana.dashboard.collapsed";

// The collapse choice: localStorage when it works, else memory for this page. Read through
// useSyncExternalStore, so the server and the first client render agree (expanded).
let memory: boolean | null = null;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  if (memory !== null) return memory;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  memory = value;
  try {
    window.localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** One nav row. Collapsed, the label is visually hidden and shown as a tooltip. */
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
  const link = (
    <Link className="lab-nav-item" href={href} aria-current={current ? "page" : undefined}>
      {icon}
      <span className="lab-nav-label">{label}</span>
      {count !== undefined ? (
        <span className="lab-nav-count" dir="ltr">
          {count}
        </span>
      ) : null}
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
  const cells = Array.from({ length: 4 }, (_, i) => card.collage[i] ?? null);
  return (
    <div className={large ? "collage is-large" : "collage"} role="img" aria-label={label}>
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

export function Dashboard({ locale, appName, view, cards, total, sharedCount, failed, email, links, t }: Props) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const [selected, setSelected] = useState<string | null>(cards[0]?.id ?? null);
  // The card the user last clicked. A second click on it opens the canvas; the first one only
  // shows its details. Starts empty so the preselected first card still needs two clicks.
  const [armed, setArmed] = useState<string | null>(null);
  const router = useRouter();
  const canvasHref = (id: string) => `/c/${encodeURIComponent(id)}`;
  const pickCard = (id: string) => {
    if (armed === id) {
      router.push(canvasHref(id));
      return;
    }
    setSelected(id);
    setArmed(id);
  };
  const [showNew, setShowNew] = useState(false);
  const newId = useId();
  const current = cards.find((c) => c.id === selected) ?? null;

  function toggleCollapsed() {
    writeCollapsed(!collapsed);
  }

  const title = view === "shared" ? t.sharedTitle : t.title;
  const collapseLabel = collapsed ? t.expand : t.collapse;

  return (
    <div className="lab" data-collapsed={collapsed ? "" : undefined}>
      {/* ------------------------------------------------------------ sidebar */}
      <aside className="lab-side" aria-label={t.sidebarLabel}>
        <Link className="lab-brand" href={links.home} dir="ltr">
          <span className="lab-brand-mark" aria-hidden="true" />
          <span className="lab-brand-name">{appName}</span>
          <span className="st-visually-hidden" lang={locale}>
            {" "}
            ({t.home})
          </span>
        </Link>

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

        <div className="lab-bottom">
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
            <li className="lab-collapse-row">
              <Tooltip content={collapseLabel} side="end" disabled={!collapsed}>
                <button type="button" className="lab-nav-item" aria-expanded={!collapsed} onClick={toggleCollapsed}>
                  {collapsed ? <ExpandIcon size={16} /> : <CollapseIcon size={16} />}
                  <span className="lab-nav-label">{collapseLabel}</span>
                </button>
              </Tooltip>
            </li>
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

      {/* ------------------------------------------------------------ main panel */}
      <main id="main" tabIndex={-1} className="lab-panel lab-main" aria-labelledby="lab-title">
        <header className="lab-head">
          <div>
            <h1 id="lab-title">{title}</h1>
            {!failed ? (
              <p className="lab-count">
                {t.count.replace("{n}", String(cards.length))}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="st-btn"
            data-variant="secondary"
            data-size="md"
            aria-expanded={showNew}
            aria-controls={newId}
            onClick={() => setShowNew((v) => !v)}
          >
            <PlusIcon size={16} />
            {t.newCanvas}
          </button>
        </header>

        <div id={newId} className="lab-new st-alert" data-tone="info" hidden={!showNew}>
          <span className="st-alert-icon">
            <InfoIcon size={16} />
          </span>
          <div className="st-alert-content">
            <p className="st-alert-title">{t.newTitle}</p>
            <p>{t.newBody}</p>
            <p>
              <a href={links.docs}>{t.newCta}</a>
            </p>
          </div>
        </div>

        {failed ? (
          <div className="st-empty lab-empty" data-variant="centered" role="alert">
            <p className="st-empty-title">{t.loadFailed}</p>
            <div className="st-empty-actions">
              <a className="st-btn" data-variant="secondary" data-size="md" href={view === "shared" ? links.shared : links.all}>
                {t.retry}
              </a>
            </div>
          </div>
        ) : cards.length === 0 ? (
          <div className="st-empty lab-empty" data-variant="centered">
            <CanvasesIcon size={24} />
            <h2 className="st-empty-title">{t.emptyTitle}</h2>
            <p className="st-empty-body">{t.emptyBody}</p>
            <p className="st-empty-body">{t.newBody}</p>
            <div className="st-empty-actions">
              <a className="st-btn" data-variant="primary" data-size="md" href={links.docs}>
                {t.newCta}
              </a>
            </div>
          </div>
        ) : (
          <ul className="lab-grid" aria-label={t.listLabel}>
            {cards.map((card) => {
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
      </main>

      {/* ------------------------------------------------------------ details panel */}
      <aside className="lab-panel lab-details" aria-labelledby="details-title">
        <h2 id="details-title" className="lab-details-head">
          {t.detailsTitle}
        </h2>
        {current ? (
          <div className="lab-details-body" aria-live="polite">
            <Collage card={current} label={t.collageLabel.replace("{title}", current.title)} large />
            <h3 className="lab-details-title" dir="auto">
              {current.title}
            </h3>
            <dl className="lab-facts">
              <dt>{t.brief}</dt>
              <dd dir={current.brief ? "auto" : undefined}>{current.brief ?? t.noBrief}</dd>
              <dt>{t.updated}</dt>
              <dd>
                <time dateTime={current.updatedAt}>{current.updatedLong}</time>
                <span className="lab-muted"> ({current.updatedRelative})</span>
              </dd>
              <dt>{t.directions}</dt>
              <dd>{current.directionCount}</dd>
              <dt>{t.references}</dt>
              <dd>{current.referenceCount === 0 ? t.noRefs : current.referenceCount}</dd>
              <dt>{t.link}</dt>
              <dd>{current.shared ? t.linkOn : t.linkOff}</dd>
            </dl>
            {current.collage.length > 0 ? (
              <>
                <h4 className="lab-sources-title">{t.sources}</h4>
                <ul className="lab-sources">
                  {current.collage.map((img, i) => (
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
            <Link className="st-btn lab-open" data-variant="primary" data-size="lg" href={`/c/${encodeURIComponent(current.id)}`}>
              {t.open}
              <ArrowEndIcon size={16} />
            </Link>
          </div>
        ) : (
          <p className="lab-details-none">{t.detailsNone}</p>
        )}
      </aside>
    </div>
  );
}
