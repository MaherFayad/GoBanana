/**
 * Pricing (spec section 12): Free $0, Pro $5/mo, Pro yearly $39/yr, Founding $29 once (first 100).
 * Studio look: plan tiles on a tile grid, price at text-6xl, the current plan marked by a chip with
 * words (not a thick border), and the comparison table in the DataTable style. Payments are off for
 * the beta: plans show "Checkout is not open yet." and signed-in users on BETA_PLAN see an info alert.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readCheckoutConfig } from "@/lib/billing/checkout";
import { foundingSeatsLeft, readPaddlePrices } from "@/lib/billing/paddle";
import { paddlePriceIdFor, PLAN_ORDER, PLAN_PRICES } from "@/lib/billing/plans";
import { getBillingRepo } from "@/lib/billing/repo";
import { CheckIcon, InfoIcon } from "@/components/studio/icons";
import { getConfig } from "@/lib/config";
import { betaPlan, PLAN_LIMITS, type Plan } from "@/lib/quota";
import { getDict, type Dict } from "@/lib/site/dict";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
import { CheckoutButton } from "./CheckoutButton";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).pricing.title } : {};
}

function priceText(plan: Plan, t: Dict["pricing"]): { amount: string; period: string } {
  const p = PLAN_PRICES[plan];
  const period = { month: t.perMonth, year: t.perYear, once: t.once, free: t.free }[p.period];
  return { amount: `$${p.amountUsd}`, period };
}

function features(plan: Plan, t: Dict["pricing"]): string[] {
  const l = PLAN_LIMITS[plan];
  return [
    fmt(t.features.searches, { n: l.searchesPerMonth }),
    Number.isFinite(l.canvases) ? fmt(t.features.canvases, { n: l.canvases }) : t.features.canvasesUnlimited,
    fmt(t.features.items, { n: l.itemsPerCanvas }),
    l.shareLinks ? t.features.share : t.features.noShare,
    plan === "free" ? t.features.exportsFree : t.features.exportsAll,
  ];
}

async function foundingSold(): Promise<number | null> {
  try {
    return await getBillingRepo().countFoundingUsers();
  } catch {
    return null;
  }
}

export default async function PricingPage({ params }: Props) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDict(locale).pricing;

  const [user, sold] = await Promise.all([getSiteUser(), foundingSold()]);
  const prices = readPaddlePrices();
  const checkout = readCheckoutConfig();
  const seatsLeft = sold === null ? null : foundingSeatsLeft(sold);
  const origin = getConfig().appUrl ?? "";
  const successUrl = `${origin}${href(locale, "account")}?checkout=done`;

  function cta(plan: Plan) {
    const name = t.plans[plan].name;
    if (user?.plan === plan) return null;
    if (plan === "free") {
      return (
        <Link className="st-btn" data-variant="secondary" data-size="lg" href={`${href(locale)}#install`}>
          {fmt(t.cta.free)}
        </Link>
      );
    }
    if (plan === "founding" && seatsLeft === 0) return <p className="note">{t.cta.soldOut}</p>;
    // Fail closed: if the founding count is unknown, do not sell past the cap.
    if (plan === "founding" && seatsLeft === null) return <p className="note">{t.cta.notReady}</p>;
    const priceId = paddlePriceIdFor(plan, prices);
    if (!priceId || !checkout.clientToken) return <p className="note">{t.cta.notReady}</p>;
    if (!user) {
      return (
        <a
          className="st-btn"
          data-variant="primary"
          data-size="lg"
          href={`${SIGN_IN_PATH}?returnTo=${encodeURIComponent(href(locale, "pricing"))}`}
        >
          {t.cta.signInToBuy}
        </a>
      );
    }
    return (
      <CheckoutButton
        priceId={priceId}
        userId={user.id}
        email={user.email}
        clientToken={checkout.clientToken}
        environment={checkout.environment}
        locale={locale}
        successUrl={successUrl}
        labels={{
          action: fmt(plan === "founding" ? t.cta.buy : t.cta.subscribe, { plan: name }),
          loading: t.cta.loading,
          loadFailed: t.cta.loadFailed,
        }}
      />
    );
  }

  const yesNo = (v: boolean) => (v ? t.yes : t.no);
  // Payments are off during the beta: BETA_PLAN gives free users Pro limits (lib/quota.ts).
  const onBeta = user?.plan === "free" && betaPlan() !== null;

  return (
    <>
      <h1>{t.title}</h1>
      <p className="lead">{t.lead}</p>

      {onBeta ? (
        <div className="st-alert alert-gap" data-tone="info" role="note">
          <span className="st-alert-icon">
            <InfoIcon size={16} />
          </span>
          <div className="st-alert-content">
            <p className="st-alert-title">{t.betaTitle}</p>
            <p>{t.betaBody}</p>
          </div>
        </div>
      ) : null}

      <ul className="st-tile-grid" aria-label={t.title}>
        {PLAN_ORDER.map((plan) => {
          const price = priceText(plan, t);
          const current = user?.plan === plan;
          const titleId = `plan-${plan}`;
          return (
            <li
              key={plan}
              id={plan === "founding" ? "founding" : undefined}
              className="st-tile plan-tile"
            >
              <div className="tile-head">
                <h2 id={titleId}>{t.plans[plan].name}</h2>
                {current ? (
                  <span className="st-chip" data-tone="success">
                    <CheckIcon size={12} />
                    <span>{t.cta.current}</span>
                  </span>
                ) : plan === "founding" ? (
                  <span className="st-chip" data-tone="explore">
                    {t.foundingChip}
                  </span>
                ) : null}
              </div>
              <p className="price">
                <span dir="ltr">{price.amount}</span> <small>{price.period}</small>
              </p>
              <p>{t.plans[plan].blurb}</p>
              <ul className="feature-list">
                {features(plan, t).map((f) => (
                  <li key={f}>
                    <CheckIcon size={16} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {plan === "founding" && seatsLeft !== null && seatsLeft > 0 ? (
                <p className="note">{fmt(t.seatsLeft, { n: seatsLeft })}</p>
              ) : null}
              <div className="tile-foot">{cta(plan)}</div>
            </li>
          );
        })}
      </ul>

      <h2>{t.compareTitle}</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.compareTitle}>
        <table>
          <caption>{t.compareCaption}</caption>
          <thead>
            <tr>
              <td />
              {PLAN_ORDER.map((plan) => (
                <th key={plan} scope="col">
                  {t.plans[plan].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t.rows.price}</th>
              {PLAN_ORDER.map((plan) => {
                const p = priceText(plan, t);
                return <td key={plan}>{`${p.amount} ${p.period}`}</td>;
              })}
            </tr>
            <tr>
              <th scope="row">{t.rows.searches}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan}>{PLAN_LIMITS[plan].searchesPerMonth}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t.rows.canvases}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan}>{Number.isFinite(PLAN_LIMITS[plan].canvases) ? PLAN_LIMITS[plan].canvases : t.unlimited}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t.rows.items}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan}>{PLAN_LIMITS[plan].itemsPerCanvas}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t.rows.share}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan}>{yesNo(PLAN_LIMITS[plan].shareLinks)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t.rows.exports}</th>
              {PLAN_ORDER.map((plan) => (
                <td key={plan}>{plan === "free" ? t.exportsFree : t.exportsAll}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="note">{t.billingNote}</p>
    </>
  );
}
