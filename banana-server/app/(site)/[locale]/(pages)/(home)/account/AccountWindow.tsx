/**
 * Account as a System Settings window on the GoBanana desktop (docs/site-redesign-spec.md): a
 * glass window with a list at the start (who is signed in, then Plan, Usage, Shared links and
 * Sign out) and the settings pane: grouped rows for the plan and billing, usage as meters, the
 * shared links note, and deleting the account (the danger-tone dialog in DeleteAccount.tsx).
 * Signed out, the same window shows a sign-in panel. Data loaders: lib/site/session.ts.
 *
 * The list items are in-page links to the groups, so everything works without JavaScript and
 * every group stays in the reading order.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { CardIcon, ChartIcon, ShareIcon, SignOutIcon, SwatchIcon } from "@/components/studio/icons";
import { pinterestImportEnabled } from "@/lib/taste-profile/pinterest";
import { createDbTasteStore } from "@/lib/taste-profile/store";
import { betaPlan, limitsFor } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";
import { getAccountUsage, getSiteUser, SIGN_IN_PATH, type AccountUsage } from "@/lib/site/session";
import { e2eAuthBypass, SIGN_OUT_PATH } from "@/lib/web-auth";
import { bidi } from "../../../../_components/Bidi";
import { TwoToneHeading } from "../../../../_components/desktop/TwoToneHeading";
import { Window } from "../../../../_components/desktop/Window";
import { DeleteAccount } from "./DeleteAccount";
import { TasteSettings } from "./TasteSettings";

/** The user's saved style words. Fails open: an unreadable profile shows as empty. */
async function readTasteWords(userId: string): Promise<string[]> {
  try {
    return (await createDbTasteStore().get(userId)).styleWords;
  } catch {
    console.error("[account] taste profile could not load");
    return [];
  }
}

/**
 * A usage meter (role="meter"): named by its row, with the same "3 of 50" text the row shows as
 * its value text. Unlimited plans get no meter, only the count.
 */
function Meter({ used, limit, label, text }: { used: number; limit: number; label: string; text: string }) {
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const pct = Math.min(100, Math.round((used / limit) * 100));
  return (
    <span
      className="usage-meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={Math.min(used, limit)}
      aria-valuetext={text}
      data-full={pct >= 100 ? "" : undefined}
    >
      <span className="usage-meter-fill" style={{ inlineSize: `${pct}%` }} />
    </span>
  );
}

/** One item in the settings list: an icon tile and a label. */
function SideItem({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <a className="settings-item" href={to}>
        <span className="settings-icon" aria-hidden="true">
          {icon}
        </span>
        {children}
      </a>
    </li>
  );
}

const DEMO_USAGE: AccountUsage = { period: "2026-10", searches: 37, canvases: 4 };

/**
 * The settings window itself. `lights` replaces the window's picture lights with working ones
 * when it stands in a WindowLayer (the intercepted route in @modal/(.)account).
 */
export async function AccountWindow({ locale, lights }: { locale: Locale; lights?: ReactNode }) {
  const dict = getDict(locale);
  const t = dict.account;

  const user = await getSiteUser();
  if (!user) {
    return (
      <Window as="div" title={t.windowTitle} className="settings" bodyClassName="settings-body" lights={lights}>
        <div className="settings-side">
          <div className="settings-user">
            <span className="settings-avatar is-empty" aria-hidden="true" />
            <span className="settings-user-text">
              <span className="settings-user-name">{t.signedOutTitle}</span>
            </span>
          </div>
        </div>
        <div className="settings-pane settings-signin">
          <span className="settings-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <TwoToneHeading as="h1" className="is-window" dim={t.signedOutDim} bright={t.signedOutBright} />
          <p className="settings-lead">{t.signedOut}</p>
          <a
            className="st-btn roll-btn"
            data-variant="primary"
            data-size="lg"
            href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(href(locale, "account"))}`}
          >
            {dict.common.signIn}
          </a>
        </div>
      </Window>
    );
  }

  // The test-only sign-in bypass has no database: it shows sample usage, like the dashboard's demo cards.
  const usage = e2eAuthBypass() && !process.env.DATABASE_URL ? DEMO_USAGE : await getAccountUsage(user.id);
  // Payments are off during the beta: BETA_PLAN gives free users Pro limits (lib/quota.ts).
  const onBeta = user.plan === "free" && betaPlan() !== null;
  const limits = limitsFor(user.plan);
  const ofLimit = (used: number, limit: number) =>
    Number.isFinite(limit) ? fmt(t.ofLimit, { used, limit }) : fmt(t.unlimited, { used });
  const tasteWords = e2eAuthBypass() && !process.env.DATABASE_URL ? [] : await readTasteWords(user.id);
  const planName = dict.pricing.plans[user.plan].name;
  const canvases = href(locale, "canvases");

  return (
    <Window as="div" title={t.windowTitle} className="settings" bodyClassName="settings-body" lights={lights}>
      <nav className="settings-side" aria-label={t.settingsLabel}>
        <div className="settings-user">
          <span className="settings-avatar" aria-hidden="true">
            {(user.email ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <span className="settings-user-text">
            <span className="settings-user-name">{t.signedInAs}</span>
            {user.email ? (
              <span className="settings-user-email">
                <bdi>{user.email}</bdi>
              </span>
            ) : null}
          </span>
        </div>
        <ul className="settings-list">
          <SideItem to="#plan-title" icon={<CardIcon size={16} />}>
            {t.planTitle}
          </SideItem>
          <SideItem to="#usage-title" icon={<ChartIcon size={16} />}>
            {t.usageTitle}
          </SideItem>
          <SideItem to="#shared-title" icon={<ShareIcon size={16} />}>
            {t.sharedTitle}
          </SideItem>
          <SideItem to="#taste-title" icon={<SwatchIcon size={16} />}>
            {t.tasteTitle}
          </SideItem>
        </ul>
        <form className="settings-signout" method="post" action={SIGN_OUT_PATH}>
          <button type="submit" className="settings-item">
            <span className="settings-icon" aria-hidden="true">
              <SignOutIcon size={16} />
            </span>
            {dict.common.signOut}
          </button>
        </form>
      </nav>

      <div className="settings-pane">
        <h1 className="settings-title">{t.title}</h1>

        <section className="settings-section" aria-labelledby="plan-title">
          <h2 id="plan-title" tabIndex={-1}>
            {t.planTitle}
          </h2>
          <div className="settings-group">
            <div className="settings-row">
              <span className="settings-row-label">{t.planLabel}</span>
              <span className="settings-row-end">
                <span className="settings-row-value">{bidi(planName)}</span>
                {onBeta ? null : (
                  <Link className="st-btn" data-variant="secondary" data-size="sm" href={href(locale, "pricing")}>
                    {t.upgrade}
                  </Link>
                )}
              </span>
            </div>
            {onBeta ? (
              <div className="settings-row">
                <span className="settings-row-label">{bidi(t.betaPlan)}</span>
                <span className="settings-row-note">{bidi(t.betaBody)}</span>
              </div>
            ) : null}
            <div className="settings-row">
              <span className="settings-row-label">{t.manageBilling}</span>
              {/* TODO(billing): link to the Paddle customer portal once a portal session endpoint exists. */}
              <span className="settings-row-note">{bidi(t.manageBillingNote)}</span>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="usage-title">
          <h2 id="usage-title" tabIndex={-1}>
            {t.usageTitle}
          </h2>
          <div className="settings-group">
            {usage ? (
              <>
                <div className="settings-row">
                  <span className="settings-row-label">{t.searches}</span>
                  <span className="settings-row-end">
                    <Meter
                      used={usage.searches}
                      limit={limits.searchesPerMonth}
                      label={fmt(t.meterLabel, { name: t.searches })}
                      text={ofLimit(usage.searches, limits.searchesPerMonth)}
                    />
                    <span className="settings-row-value">{ofLimit(usage.searches, limits.searchesPerMonth)}</span>
                  </span>
                </div>
                <div className="settings-row">
                  <span className="settings-row-label">{t.canvases}</span>
                  <span className="settings-row-end">
                    <Meter
                      used={usage.canvases}
                      limit={limits.canvases}
                      label={fmt(t.meterLabel, { name: t.canvases })}
                      text={ofLimit(usage.canvases, limits.canvases)}
                    />
                    <span className="settings-row-value">{ofLimit(usage.canvases, limits.canvases)}</span>
                  </span>
                </div>
              </>
            ) : (
              <div className="settings-row">
                <span className="settings-row-note">{t.usageUnavailable}</span>
              </div>
            )}
          </div>
        </section>

        <section className="settings-section" aria-labelledby="shared-title">
          <h2 id="shared-title" tabIndex={-1}>
            {t.sharedTitle}
          </h2>
          <div className="settings-group">
            <div className="settings-row">
              <span className="settings-row-label">{bidi(t.sharedBody)}</span>
              <Link className="st-btn" data-variant="secondary" data-size="sm" href={`${canvases}?view=shared`}>
                {t.sharedLink}
              </Link>
            </div>
            <div className="settings-row">
              <span className="settings-row-label">{bidi(t.canvasesBody)}</span>
              <Link className="st-btn" data-variant="secondary" data-size="sm" href={canvases}>
                {t.canvasesLink}
              </Link>
            </div>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="taste-title">
          <h2 id="taste-title" tabIndex={-1}>
            {t.tasteTitle}
          </h2>
          <p className="settings-lead">{t.tasteBody}</p>
          <div className="settings-group">
            <TasteSettings
              words={tasteWords}
              pinterestHref={pinterestImportEnabled(process.env) ? "/api/taste/pinterest/start" : undefined}
              labels={{
                wordsLabel: t.tasteWordsLabel,
                empty: t.tasteEmpty,
                clear: t.tasteClear,
                clearing: t.tasteClearing,
                cleared: t.tasteCleared,
                clearFailed: t.tasteClearFailed,
                importLabel: t.tasteImportLabel,
                importNote: t.tasteImportNote,
                importButton: t.tasteImportButton,
                importing: t.tasteImporting,
                imported: t.tasteImported,
                importFailed: t.tasteImportFailed,
                importCount: t.tasteImportCount,
                pinterest: t.tastePinterest,
                pinterestNote: t.tastePinterestNote,
              }}
            />
          </div>
        </section>

        <section className="settings-section" aria-labelledby="delete-title">
          <h2 id="delete-title" className="st-visually-hidden">
            {t.deleteTitle}
          </h2>
          <div className="settings-group">
            <div className="settings-row">
              <span className="settings-row-label">{bidi(t.deleteBody)}</span>
              <DeleteAccount
                afterDeleteHref={href(locale)}
                labels={{
                  deleteButton: t.deleteButton,
                  confirmEyebrow: t.confirmEyebrow,
                  confirmTitle: t.confirmTitle,
                  confirmDeleted: t.confirmDeleted,
                  confirmKept: t.confirmKept,
                  confirmBilling: t.confirmBilling,
                  confirmCheck: t.confirmCheck,
                  confirmButton: t.confirmButton,
                  cancel: t.cancel,
                  close: dict.common.close,
                  deleting: t.deleting,
                  deleteFailed: t.deleteFailed,
                  deleteDone: t.deleteDone,
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </Window>
  );
}
