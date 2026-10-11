/**
 * Pricing (spec section 12): Free $0, Pro $5/mo, Pro yearly $39/yr, Founding $29 once (first 100).
 * Structure after pryzm.design's pricing (centered heading, a Monthly / Yearly switch, plan
 * cards), Studio skin: price at text-6xl, the current plan marked by a chip with words (not a
 * thick border), and the comparison table in the DataTable style. Payments are off for the beta
 * (BETA_PLAN): everyone sees that in an info alert, and plans show "Checkout is not open yet."
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readCheckoutConfig } from "@/lib/billing/checkout";
import { foundingSeatsLeft, readPaddlePrices } from "@/lib/billing/paddle";
import { paddlePriceIdFor, PLAN_ORDER } from "@/lib/billing/plans";
import { getBillingRepo } from "@/lib/billing/repo";
import { CheckIcon, InfoIcon } from "@/components/studio/icons";
import { getConfig } from "@/lib/config";
import { betaPlan, PLAN_LIMITS, type Plan } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { planFeatureItems, priceText } from "@/lib/site/plans";
import { getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
import { bidi } from "../../../_components/Bidi";
import { BetaBadge, PlanFeatureList } from "../../../_components/PlanBits";
import { PricingToggle } from "../../../_components/PricingToggle";
import { Reveal } from "../../../_components/Reveal";
import { CheckoutButton } from "./CheckoutButton";
import "../../../_components/landing.css";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).pricing.title } : {};
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
  const dict = getDict(locale);
  const t = dict.pricing;

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
  const beta = betaPlan() !== null;
  // Signed in on the free plan during the beta: the account already has Pro limits.
  const onBeta = user?.plan === "free" && beta;

  function card(plan: Plan, extraClass = "") {
    const price = priceText(plan, t);
    const current = user?.plan === plan;
    return (
      <>
        <div className="plan-head">
          <h2 id={`plan-${plan}`}>{bidi(t.plans[plan].name)}</h2>
          {current ? (
            <span className="st-chip" data-tone="success">
              <CheckIcon size={12} />
              <span>{t.cta.current}</span>
            </span>
          ) : plan === "founding" ? (
            <span className="st-chip" data-tone="explore">
              {t.foundingChip}
            </span>
          ) : plan !== "free" && beta ? (
            <BetaBadge>{bidi(dict.landing.pricing.betaBadge)}</BetaBadge>
          ) : null}
        </div>
        <p className={`plan-price ${extraClass}`}>
          <bdi className="plan-amount" dir="ltr">{price.amount}</bdi> <small>{price.period}</small>
        </p>
        <p className="plan-blurb">{t.plans[plan].blurb}</p>
        <PlanFeatureList items={planFeatureItems(plan, t)} />
        {plan === "founding" && seatsLeft !== null && seatsLeft > 0 ? (
          <p className="note">{fmt(t.seatsLeft, { n: seatsLeft })}</p>
        ) : null}
        <div className="plan-cta">{cta(plan)}</div>
      </>
    );
  }

  return (
    <div className="wrap page">
      <Reveal className="band-head is-center">
        <p className="eyebrow">{t.eyebrow}</p>
        <h1 className="pricing-title">{bidi(dict.landing.pricing.title)}</h1>
        <p className="band-lead">{t.lead}</p>
      </Reveal>

      {onBeta || beta ? (
        <div className="st-alert alert-gap pricing-alert" data-tone="info" role="note">
          <span className="st-alert-icon">
            <InfoIcon size={16} />
          </span>
          <div className="st-alert-content">
            <p className="st-alert-title">{bidi(onBeta ? t.betaTitle : t.betaAllTitle)}</p>
            <p>{bidi(onBeta ? t.betaBody : t.betaAllBody)}</p>
          </div>
        </div>
      ) : null}

      <Reveal index={1}>
        <PricingToggle labels={{ period: t.period, monthly: t.monthly, yearly: t.yearly, save: t.yearlySave }}>
          <ul className="plans is-three" aria-label={t.title}>
            <li className="plan">
              {card("free")}
            </li>
            <li className="plan is-pro period-month">
              {card("pro_monthly")}
            </li>
            <li className="plan is-pro period-year">
              {card("pro_yearly")}
            </li>
            <li id="founding" className="plan">
              {card("founding")}
            </li>
          </ul>
        </PricingToggle>
      </Reveal>

      <h2 className="compare-title">{t.compareTitle}</h2>
      <div className="table-scroll" tabIndex={0} role="region" aria-label={t.compareTitle}>
        <table>
          <caption>{t.compareCaption}</caption>
          <thead>
            <tr>
              <td />
              {PLAN_ORDER.map((plan) => (
                <th key={plan} scope="col">
                  {bidi(t.plans[plan].name)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t.rows.price}</th>
              {PLAN_ORDER.map((plan) => {
                const p = priceText(plan, t);
                return (
                  <td key={plan}>
                    <bdi dir="ltr">{p.amount}</bdi> {p.period}
                  </td>
                );
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
                <td key={plan}>{bidi(plan === "free" ? t.exportsFree : t.exportsAll)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="note">{bidi(t.billingNote)}</p>
    </div>
  );
}
