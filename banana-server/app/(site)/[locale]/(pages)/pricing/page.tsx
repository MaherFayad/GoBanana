/**
 * Pricing (spec section 12): Free $0, Pro $5/mo, Pro yearly $39/yr, Founding $29 once (first 100).
 * Structure after pryzm.design's pricing (centered heading, a Monthly / Yearly switch, plan
 * cards), Studio skin: price at text-6xl, the current plan marked by a chip with words (not a
 * thick border), and the comparison table in the DataTable style. Payments are off for the beta
 * (BETA_PLAN): everyone sees that in an info alert, and plans show "Checkout is not open yet."
 *
 * GoBanana desktop, in the landing page's language (docs/landing-motion-spec.md): a big two-tone
 * heading, the beta as a notification card, then two windows you can drag:
 * `plans.app` holds the plans side by side split by hairlines, and `compare.app` holds the
 * comparison table (13px, sentence case). Under 768px the plans stack and the table becomes one
 * block per plan (pricing.css swaps them; both carry the same facts).
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readCheckoutConfig } from "@/lib/billing/checkout";
import { foundingSeatsLeft, readPaddlePrices } from "@/lib/billing/paddle";
import { paddlePriceIdFor, PLAN_ORDER } from "@/lib/billing/plans";
import { getBillingRepo } from "@/lib/billing/repo";
import { BrandMark } from "@/components/brand/BrandMark";
import { CheckIcon } from "@/components/studio/icons";
import { getConfig } from "@/lib/config";
import { betaPlan, PLAN_LIMITS, type Plan } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { planFeatureItems, priceText } from "@/lib/site/plans";
import { getSiteUser, SIGN_IN_PATH } from "@/lib/site/session";
import { bidi } from "../../../_components/Bidi";
import { BetaBadge, PlanFeatureList } from "../../../_components/PlanBits";
import { PricingToggle } from "../../../_components/PricingToggle";
import { TwoToneHeading } from "../../../_components/desktop/TwoToneHeading";
import { Window } from "../../../_components/desktop/Window";
import { CheckoutButton } from "./CheckoutButton";
import "../../../_components/landing.css";
import "./pricing.css";

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
        <Link className="st-btn" data-variant="secondary" data-size="md" href={href(locale, "install")}>
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
          data-size="md"
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

  const rows: { label: string; value: (plan: Plan) => ReactNode }[] = [
    {
      label: t.rows.price,
      value: (plan) => {
        const p = priceText(plan, t);
        return (
          <>
            <bdi dir="ltr">{p.amount}</bdi> {p.period}
          </>
        );
      },
    },
    { label: t.rows.searches, value: (plan) => PLAN_LIMITS[plan].searchesPerMonth },
    { label: t.rows.canvases, value: (plan) => (Number.isFinite(PLAN_LIMITS[plan].canvases) ? PLAN_LIMITS[plan].canvases : t.unlimited) },
    { label: t.rows.items, value: (plan) => PLAN_LIMITS[plan].itemsPerCanvas },
    { label: t.rows.share, value: (plan) => yesNo(PLAN_LIMITS[plan].shareLinks) },
    { label: t.rows.exports, value: (plan) => bidi(plan === "free" ? t.exportsFree : t.exportsAll) },
  ];

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

  const pp = dict.landing.desk.pricingPage;
  const win = dict.landing.desk.window;
  const plansCls: Record<Plan, string> = { free: "", pro_monthly: " is-pro period-month", pro_yearly: " is-pro period-year", founding: "" };

  return (
    <div className="pp">
      <header className="pp-head">
        <TwoToneHeading as="h1" className="pp-title" dim={bidi(pp.dim)} bright={bidi(pp.bright)} />
        <p className="pp-lead">{t.lead}</p>
      </header>

      {onBeta || beta ? (
        <div className="pp-note" role="note">
          <span className="pp-note-icon" aria-hidden="true">
            <BrandMark />
          </span>
          <div>
            <p className="pp-note-title">{bidi(onBeta ? t.betaTitle : t.betaAllTitle)}</p>
            <p>{bidi(onBeta ? t.betaBody : t.betaAllBody)}</p>
          </div>
        </div>
      ) : null}

      <PricingToggle className="pp-scope" labels={{ period: t.period, monthly: t.monthly, yearly: t.yearly, save: t.yearlySave }}>
        <Window id="plans-app" title={pp.plans} titleNode={<bdi dir="ltr">{pp.plans}</bdi>} className="pp-win" bodyClassName="pp-plans-body" controls labels={win}>
          <ul className="pp-plans" aria-label={t.title}>
            {PLAN_ORDER.map((plan) => (
              <li key={plan} id={plan === "founding" ? "founding" : undefined} className={`plan pp-plan${plansCls[plan]}`}>
                {card(plan)}
              </li>
            ))}
          </ul>
        </Window>
      </PricingToggle>

      <Window id="compare-app" title={pp.compare} titleNode={<bdi dir="ltr">{pp.compare}</bdi>} className="pp-win pp-compare" controls labels={win}>
        <h2 className="pp-compare-title">{t.compareTitle}</h2>
        <div className="table-scroll pp-table" tabIndex={0} role="region" aria-label={t.compareTitle}>
          <table>
            <caption className="st-visually-hidden">{t.compareCaption}</caption>
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
              {rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {PLAN_ORDER.map((plan) => (
                    <td key={plan}>{r.value(plan)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="pp-cards" aria-label={dict.landing.desk.compareCards}>
          {PLAN_ORDER.map((plan) => (
            <li key={plan} aria-labelledby={`compare-${plan}`}>
              <h3 id={`compare-${plan}`}>{bidi(t.plans[plan].name)}</h3>
              <dl>
                {rows.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value(plan)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Window>

      <p className="pp-fine">{bidi(t.billingNote)}</p>
    </div>
  );
}
