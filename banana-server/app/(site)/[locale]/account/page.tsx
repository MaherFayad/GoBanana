/**
 * Account: plan, usage this month, billing note, sign out, delete account. Data loaders:
 * lib/site/session.ts. Studio look: sections with a hairline and a title; the beta state is an
 * info alert; deleting goes through the danger-tone dialog (DeleteAccount.tsx).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InfoIcon } from "@/components/studio/icons";
import { betaPlan, limitsFor } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale } from "@/lib/site/i18n";
import { getAccountUsage, getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
import { SIGN_OUT_PATH } from "@/lib/web-auth";
import { DeleteAccount } from "./DeleteAccount";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).account.title, robots: { index: false } } : {};
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.account;

  const user = await getSiteUser();
  if (!user) {
    return (
      <>
        <h1>{t.title}</h1>
        <p>{t.signedOut}</p>
        <div className="actions">
          <a
            className="st-btn"
            data-variant="primary"
            data-size="lg"
            href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(href(locale, "account"))}`}
          >
            {dict.common.signIn}
          </a>
        </div>
      </>
    );
  }

  const usage = await getAccountUsage(user.id);
  // Payments are off during the beta: BETA_PLAN gives free users Pro limits (lib/quota.ts).
  const onBeta = user.plan === "free" && betaPlan() !== null;
  const limits = limitsFor(user.plan);
  const ofLimit = (used: number, limit: number) =>
    Number.isFinite(limit) ? fmt(t.ofLimit, { used, limit }) : fmt(t.unlimited, { used });

  return (
    <>
      <div className="account-head">
        <div>
          <h1>{t.title}</h1>
          {user.email ? (
            <p className="note">
              <bdi>{user.email}</bdi>
            </p>
          ) : null}
        </div>
        <form method="post" action={SIGN_OUT_PATH}>
          <button type="submit" className="st-btn" data-variant="secondary" data-size="lg">
            {dict.common.signOut}
          </button>
        </form>
      </div>

      <section className="section" aria-labelledby="plan-title">
        <h2 id="plan-title">{t.planTitle}</h2>
        <dl className="facts">
          <dt>{t.planLabel}</dt>
          <dd>{dict.pricing.plans[user.plan].name}</dd>
        </dl>
        {onBeta ? (
          <div className="st-alert alert-gap" data-tone="info" role="note">
            <span className="st-alert-icon">
              <InfoIcon size={16} />
            </span>
            <div className="st-alert-content">
              <p className="st-alert-title">{t.betaPlan}</p>
              <p>{t.betaBody}</p>
            </div>
          </div>
        ) : (
          <div className="actions flush-start alert-gap">
            <Link className="st-btn" data-variant="secondary" data-size="lg" href={href(locale, "pricing")}>
              {t.upgrade}
            </Link>
          </div>
        )}
        <h3>{t.manageBilling}</h3>
        {/* TODO(billing): link to the Paddle customer portal once a portal session endpoint exists. */}
        <p>{t.manageBillingNote}</p>
      </section>

      <section className="section" aria-labelledby="usage-title">
        <h2 id="usage-title">{t.usageTitle}</h2>
        {usage ? (
          <dl className="facts">
            <dt>{t.searches}</dt>
            <dd>{ofLimit(usage.searches, limits.searchesPerMonth)}</dd>
            <dt>{t.canvases}</dt>
            <dd>{ofLimit(usage.canvases, limits.canvases)}</dd>
          </dl>
        ) : (
          <p>{t.usageUnavailable}</p>
        )}
      </section>

      <section className="section danger" aria-labelledby="delete-title">
        <h2 id="delete-title">{t.deleteTitle}</h2>
        <p>{t.deleteBody}</p>
        <DeleteAccount
          afterDeleteHref={href(locale)}
          labels={{
            deleteButton: t.deleteButton,
            confirmEyebrow: t.confirmEyebrow,
            confirmTitle: t.confirmTitle,
            confirmDeleted: t.confirmDeleted,
            confirmKept: t.confirmKept,
            confirmCheck: t.confirmCheck,
            confirmButton: t.confirmButton,
            cancel: t.cancel,
            close: dict.common.close,
            deleting: t.deleting,
            deleteFailed: t.deleteFailed,
            deleteDone: t.deleteDone,
          }}
        />
      </section>
    </>
  );
}
