/** Account: plan, usage this month, billing note, delete account. Data loaders are stubs (lib/site/session.ts). */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { limitsFor } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale } from "@/lib/site/i18n";
import { getAccountUsage, getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
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
        <a className="button" href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(href(locale, "account"))}`}>
          {dict.common.signIn}
        </a>
      </>
    );
  }

  const usage = await getAccountUsage(user.id);
  const limits = limitsFor(user.plan);
  const ofLimit = (used: number, limit: number) =>
    Number.isFinite(limit) ? fmt(t.ofLimit, { used, limit }) : fmt(t.unlimited, { used });

  return (
    <>
      <h1>{t.title}</h1>
      {user.email ? <p className="note">{user.email}</p> : null}

      <section aria-labelledby="plan-title">
        <h2 id="plan-title">{t.planTitle}</h2>
        <dl>
          <dt>{t.planLabel}</dt>
          <dd>{dict.pricing.plans[user.plan].name}</dd>
        </dl>
        <div className="actions">
          <Link className="button secondary" href={href(locale, "pricing")}>
            {t.upgrade}
          </Link>
        </div>
        <h3>{t.manageBilling}</h3>
        {/* TODO(billing): link to the Paddle customer portal once a portal session endpoint exists. */}
        <p>{t.manageBillingNote}</p>
      </section>

      <section aria-labelledby="usage-title">
        <h2 id="usage-title">{t.usageTitle}</h2>
        {usage ? (
          <dl>
            <dt>{t.searches}</dt>
            <dd>{ofLimit(usage.searches, limits.searchesPerMonth)}</dd>
            <dt>{t.canvases}</dt>
            <dd>{ofLimit(usage.canvases, limits.canvases)}</dd>
          </dl>
        ) : (
          <p>{t.usageUnavailable}</p>
        )}
      </section>

      <section aria-labelledby="delete-title" className="danger-zone">
        <h2 id="delete-title" style={{ marginBlockStart: 0 }}>
          {t.deleteTitle}
        </h2>
        <p>{t.deleteBody}</p>
        <DeleteAccount
          afterDeleteHref={href(locale)}
          labels={{
            deleteButton: t.deleteButton,
            confirmTitle: t.confirmTitle,
            confirmBody: t.confirmBody,
            confirmCheck: t.confirmCheck,
            confirmButton: t.confirmButton,
            cancel: t.cancel,
            deleting: t.deleting,
            deleteFailed: t.deleteFailed,
            deleteDone: t.deleteDone,
          }}
        />
      </section>
    </>
  );
}
