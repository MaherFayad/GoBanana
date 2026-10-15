/**
 * The swipe file as a settings style window (VAL-09): parts and great references the user saved
 * across boards, searchable by role, card id and words. Server rendered, no client JavaScript:
 * the filters are a GET form and Remove is a server action form, so every control works with the
 * keyboard and without scripts. Items are links, roles and crops only (never image bytes); a part
 * shows its crop as an outline over the source thumbnail, and each item links to its source.
 * Signed out, the same window shows a sign-in panel.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { AccountIcon, CanvasesIcon, GridIcon } from "@/components/studio/icons";
import { getRepos, memoTakedowns } from "@/lib/db";
import { demoLibrary, loadLibrary, parseFilters, type LibraryCard, type LibraryLoad } from "@/lib/site/library";
import { getDict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";
import { getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
import { PART_ROLES } from "@/lib/stitch/types";
import { getSwipeRepo } from "@/lib/swipe/repo";
import { e2eAuthBypass } from "@/lib/web-auth";
import { bidi } from "../../../../_components/Bidi";
import { TwoToneHeading } from "../../../../_components/desktop/TwoToneHeading";
import { Window } from "../../../../_components/desktop/Window";
import { removeSwipeItem } from "./actions";
import "./library.css";

function SideItem({ to, icon, current, children }: { to: string; icon: ReactNode; current?: boolean; children: ReactNode }) {
  return (
    <li>
      <Link className="settings-item" href={to} aria-current={current ? "page" : undefined}>
        <span className="settings-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
      </Link>
    </li>
  );
}

function Thumb({ item }: { item: LibraryCard }) {
  return (
    // The thumbnail is a picture of the source, drawn left to right whatever the page direction.
    <div className="lib-thumb" dir="ltr" aria-hidden="true">
      {item.src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote thumbnails load from their own host (hard rule 2: never re-hosted or optimized through this server)
        <img src={item.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      ) : null}
      {item.crop ? (
        <span
          className="lib-crop"
          style={{
            insetInlineStart: `${Math.round(item.crop.x * 100)}%`,
            insetBlockStart: `${Math.round(item.crop.y * 100)}%`,
            inlineSize: `${Math.round(item.crop.w * 100)}%`,
            blockSize: `${Math.round(item.crop.h * 100)}%`,
          }}
        />
      ) : null}
    </div>
  );
}

export async function LibraryWindow({
  locale,
  lights,
  query,
}: {
  locale: Locale;
  lights?: ReactNode;
  query: Record<string, string | string[] | undefined>;
}) {
  const dict = getDict(locale);
  const t = dict.library;
  const user = await getSiteUser();

  if (!user) {
    return (
      <Window as="div" title={t.windowTitle} className="settings" bodyClassName="settings-body" lights={lights}>
        <div className="settings-side">
          <div className="settings-user">
            <span className="settings-avatar is-empty" aria-hidden="true" />
            <span className="settings-user-text">
              <span className="settings-user-name">{dict.account.signedOutTitle}</span>
            </span>
          </div>
        </div>
        <div className="settings-pane settings-signin">
          <span className="settings-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <TwoToneHeading as="h1" className="is-window" dim={dict.account.signedOutDim} bright={t.title} />
          <p className="settings-lead">{t.signedOut}</p>
          <a className="st-btn roll-btn" data-variant="primary" data-size="lg" href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(href(locale, "library"))}`}>
            {dict.common.signIn}
          </a>
        </div>
      </Window>
    );
  }

  const filters = parseFilters(query);
  const filtered = Boolean(filters.role || filters.q || filters.card);
  // The test-only sign-in bypass has no database: it shows two sample items.
  const load: LibraryLoad =
    e2eAuthBypass() && !process.env.DATABASE_URL
      ? demoLibrary()
      : await loadLibrary(user.id, filters, {
          swipe: getSwipeRepo,
          loadMatcher: () => memoTakedowns(getRepos().takedowns)(),
        });

  const self = href(locale, "library");
  return (
    <Window as="div" title={t.windowTitle} className="settings" bodyClassName="settings-body" lights={lights}>
      <nav className="settings-side" aria-label={t.sideLabel}>
        <div className="settings-user">
          <span className="settings-avatar" aria-hidden="true">
            {(user.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="settings-user-text">
            <span className="settings-user-name">{dict.account.signedInAs}</span>
            {user.email ? (
              <span className="settings-user-email">
                <bdi>{user.email}</bdi>
              </span>
            ) : null}
          </span>
        </div>
        <ul className="settings-list">
          <SideItem to={self} icon={<GridIcon size={16} />} current>
            {t.title}
          </SideItem>
          <SideItem to={href(locale, "canvases")} icon={<CanvasesIcon size={16} />}>
            {dict.account.canvasesLink}
          </SideItem>
          <SideItem to={href(locale, "account")} icon={<AccountIcon size={16} />}>
            {dict.dashboard.account}
          </SideItem>
        </ul>
      </nav>

      <div className="settings-pane">
        <h1 className="settings-title">{t.title}</h1>
        <p className="settings-lead lib-lead">{bidi(t.lead)}</p>

        <form className="lib-filters" method="get" action={self} role="search" aria-label={t.filterLabel}>
          <label className="lib-field">
            <span>{t.role}</span>
            <select className="st-input" name="role" defaultValue={filters.role}>
              <option value="">{t.anyRole}</option>
              {PART_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="lib-field">
            <span>{t.search}</span>
            <input className="st-input" type="search" name="q" defaultValue={filters.q} maxLength={80} />
          </label>
          <label className="lib-field">
            <span>{t.card}</span>
            <input className="st-input" type="text" name="card" defaultValue={filters.card} maxLength={60} dir="ltr" />
          </label>
          <div className="lib-actions">
            <button type="submit" className="st-btn" data-variant="primary" data-size="md">
              {t.apply}
            </button>
            {filtered ? (
              <Link className="st-btn" data-variant="ghost" data-size="md" href={self}>
                {t.clear}
              </Link>
            ) : null}
          </div>
        </form>

        <section className="settings-section" aria-labelledby="lib-list-title">
          <h2 id="lib-list-title" tabIndex={-1}>
            {t.listLabel}
          </h2>
          {!load.ok ? (
            <div className="settings-group">
              <div className="settings-row">
                <span className="settings-row-note" role="alert">
                  {t.loadFailed}
                </span>
              </div>
            </div>
          ) : load.items.length === 0 ? (
            <div className="st-empty" data-variant="card">
              <p className="st-empty-title">{load.total === 0 ? t.emptyTitle : t.noMatch}</p>
              {load.total === 0 ? <p className="st-empty-body">{bidi(t.emptyBody)}</p> : null}
            </div>
          ) : (
            <>
              <p className="lib-count" role="status">
                {fmt(t.count, { n: load.items.length, total: load.total })}
              </p>
              <ul className="lib-list settings-group">
                {load.items.map((item) => {
                  const title = item.title ?? t.untitled;
                  return (
                    <li key={item.id} className="lib-item">
                      <Thumb item={item} />
                      <div className="lib-text">
                        <p className="lib-title">{bidi(title)}</p>
                        <p className="lib-meta">
                          <span className="st-chip" data-tone="neutral">
                            {item.kind === "part" ? `${t.part}: ${item.role ?? "other"}` : t.reference}
                          </span>
                          {item.cardId ? (
                            <span className="lib-card">
                              {t.card}: <bdi dir="ltr">{item.cardId}</bdi>
                            </span>
                          ) : null}
                          <a className="lib-source" href={item.sourceUrl} rel="noopener noreferrer" referrerPolicy="no-referrer">
                            {t.source}: <bdi dir="ltr">{item.sourceSite}</bdi>
                          </a>
                        </p>
                        {item.note ? <p className="lib-note">{bidi(item.note)}</p> : null}
                      </div>
                      <form action={removeSwipeItem} className="lib-remove">
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="role" value={filters.role} />
                        <input type="hidden" name="q" value={filters.q} />
                        <input type="hidden" name="card" value={filters.card} />
                        <button type="submit" className="st-btn" data-variant="secondary" data-size="sm" aria-label={fmt(t.removeLabel, { title })}>
                          {t.remove}
                        </button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="settings-section" aria-labelledby="lib-how-title">
          <h2 id="lib-how-title" tabIndex={-1}>
            {t.howTitle}
          </h2>
          <div className="settings-group">
            <div className="settings-row">
              <span className="settings-row-label">{bidi(t.howBody)}</span>
            </div>
          </div>
        </section>
      </div>
    </Window>
  );
}
