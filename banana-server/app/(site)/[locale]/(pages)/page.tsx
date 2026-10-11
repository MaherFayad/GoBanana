/**
 * Landing page: /en and /ar. "/" stays with app/page.tsx and redirects here.
 *
 * Structure and behavior after pryzm.design (owner decision, DECISIONS.md): a draggable field
 * of tiles in the hero, then the product in a window frame, a graph of the flow, a gallery, the
 * export, set up, pricing, FAQ, a final call to action and the footer, with scroll reveals.
 * The look is GoBanana's own: Studio tokens, light and dark, Inter and IBM Plex Sans Arabic,
 * the yellow primary button, Pixelarticons, and generative art drawn with CSS and SVG only.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowEndIcon, CheckIcon, SparkleIcon } from "@/components/studio/icons";
import { APP_NAME, getConfig } from "@/lib/config";
import { betaPlan } from "@/lib/quota";
import { getDict } from "@/lib/site/dict";
import { SAMPLE_DESIGN_MD, SAMPLE_TOKENS } from "@/lib/site/export-sample";
import { fmt, href, isLocale } from "@/lib/site/i18n";
import { GALLERY_BOARDS, HERO_TILES } from "@/lib/site/moves";
import { planFeatures, priceText } from "@/lib/site/plans";
import { CodeBlock } from "../../_components/CodeBlock";
import { GraphWires } from "../../_components/GraphWires";
import { HeroField } from "../../_components/HeroField";
import { PricingToggle } from "../../_components/PricingToggle";
import { ProductFrame } from "../../_components/ProductFrame";
import { Reveal } from "../../_components/Reveal";
import { TileArt } from "../../_components/TileArt";
import "../../_components/landing.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: { absolute: fmt(getDict(locale).landing.title) } };
}

function mcpUrl(): string {
  const cfg = getConfig();
  return cfg.mcpResourceUrl ?? "https://YOUR-DOMAIN/api/mcp";
}

/** Server name for client configs, derived from APP_NAME ("GoBanana" -> "gobanana"). */
function serverName(): string {
  return APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
}

/** Small picture inside each graph node, so the flow reads at a glance. Decorative. */
function GraphDeco({ index, moves }: { index: number; moves: string[] }) {
  switch (index) {
    case 0:
      return (
        <span className="graph-deco graph-deco-input">
          <span className="graph-caret" />
        </span>
      );
    case 1:
      return (
        <span className="graph-deco graph-deco-chips">
          {moves.map((m) => (
            <span key={m} className="graph-mini-chip">
              {m}
            </span>
          ))}
        </span>
      );
    case 2:
      return (
        <span className="graph-deco graph-deco-bars">
          <span />
          <span />
          <span />
        </span>
      );
    case 3:
      return (
        <span className="graph-deco graph-deco-refs">
          {(["sadu", "halftone", "dusk", "swiss"] as const).map((k) => (
            <TileArt key={k} kind={k} uid={`graph-${k}`} />
          ))}
        </span>
      );
    default:
      return (
        <span className="graph-deco graph-deco-files" dir="ltr">
          <span>DESIGN.md</span>
          <span>tokens.json</span>
          <span>tailwind.css</span>
        </span>
      );
  }
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.landing;
  const p = dict.pricing;
  const beta = betaPlan() !== null;

  const url = mcpUrl();
  const name = serverName();
  const claudeCmd = `claude mcp add --transport http ${name} ${url}`;
  const cursorJson = JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2);
  // Code labels and copy buttons follow the page language; the code itself is always ltr.
  const labelLang = locale === "ar" ? "ar" : undefined;
  const copyLabels = { done: t.copy.done, doneBody: t.copy.doneBody, failed: t.copy.failed, failedBody: t.copy.failedBody };

  const tiles = HERO_TILES.map((tile, i) => {
    const move = t.moves[i]!;
    return { ...tile, ...move, caption: fmt(t.field.caption, { name: move.name, color: move.color }) };
  });
  const graphMoves = t.moves.slice(0, 6).map((m) => m.move).filter((m, i, all) => all.indexOf(m) === i);
  const monthly = priceText("pro_monthly", p);
  const yearly = priceText("pro_yearly", p);
  const free = priceText("free", p);

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero" aria-labelledby="hero-title">
        <HeroField tiles={tiles} labels={t.field} />
        <div className="hero-copy">
          <div className="wrap hero-copy-grid">
            <div className="hero-copy-start">
              <p className="st-chip hero-chip">
                <SparkleIcon size={12} />
                <span>{t.heroChip}</span>
              </p>
              <h1 id="hero-title" className="hero-title">
                {fmt(t.heroTitle)}
              </h1>
            </div>
            <div className="hero-copy-end">
              <p className="hero-lead">{fmt(t.heroLead)}</p>
              <div className="actions">
                <a className="st-btn" data-variant="primary" data-size="lg" href="#install">
                  {t.ctaAdd}
                  <ArrowEndIcon size={16} />
                </a>
                <a className="st-btn" data-variant="secondary" data-size="lg" href="#gallery">
                  {t.ctaExample}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ product in a frame */}
      <section className="band" aria-labelledby="frame-title">
        <div className="wrap">
          <Reveal className="band-head">
            <p className="eyebrow">{t.frame.eyebrow}</p>
            <h2 id="frame-title">{t.frame.title}</h2>
            <p className="band-lead">{t.frame.lead}</p>
          </Reveal>
          <Reveal index={1}>
            <ProductFrame t={t.frame} />
          </Reveal>
          <Reveal index={2} className="band-foot">
            <Link className="st-btn" data-variant="ghost" data-size="lg" href={href(locale, "canvases")}>
              {t.frame.cta}
              <ArrowEndIcon size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ graph */}
      <section className="band" aria-labelledby="how">
        <div className="wrap">
          <Reveal className="band-head">
            <p className="eyebrow">{t.graph.eyebrow}</p>
            <h2 id="how" tabIndex={-1}>
              {t.graph.title}
            </h2>
            <p className="band-lead">{fmt(t.graph.lead)}</p>
          </Reveal>
          <Reveal index={1} className="graph">
            <div className="graph-canvas">
            <ol id="graph-nodes" className="graph-nodes" aria-label={t.graph.label}>
              {t.graph.nodes.map((node, i) => (
                <li key={node.title} className="graph-node" data-node="" data-step={i + 1}>
                  <span className="graph-kind">
                    <span className="graph-step" dir="ltr">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {node.kind}
                  </span>
                  <h3>{node.title}</h3>
                  <p>{node.body}</p>
                  <GraphDeco index={i} moves={graphMoves} />
                </li>
              ))}
            </ol>
            <GraphWires targetId="graph-nodes" />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ gallery */}
      <section className="band" aria-labelledby="gallery">
        <div className="wrap">
          <Reveal className="band-head">
            <p className="eyebrow">{t.gallery.eyebrow}</p>
            <h2 id="gallery" tabIndex={-1}>
              {fmt(t.gallery.title)}
            </h2>
            <p className="band-lead">{t.gallery.lead}</p>
          </Reveal>
          <ul className="gallery">
            {t.gallery.cards.map((card, i) => (
              <Reveal as="li" key={card.title} index={i} className="gallery-card">
                <span className="gallery-art">
                  {GALLERY_BOARDS[i]!.map((kind, j) => (
                    <TileArt key={`${kind}-${j}`} kind={kind} uid={`gallery-${i}-${j}`} />
                  ))}
                </span>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
                <span className="gallery-tags">
                  {card.tags.map((tag) => (
                    <span key={tag} className="st-chip">
                      {tag}
                    </span>
                  ))}
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------ ship as code */}
      <section className="band" aria-labelledby="ship-title">
        <div className="wrap">
          <div className="ship">
            <Reveal className="ship-text">
              <p className="eyebrow">{t.ship.eyebrow}</p>
              <h2 id="ship-title">{t.ship.title}</h2>
              <p className="band-lead">{t.ship.lead}</p>
            </Reveal>
            <Reveal index={1} className="ship-cta">
              <a className="st-btn" data-variant="secondary" data-size="lg" href="#install">
                {t.ship.cta}
                <ArrowEndIcon size={16} />
              </a>
            </Reveal>
          </div>
          <Reveal as="ul" index={1} className="formats">
            {t.ship.formats.map((f) => (
              <li key={f.name}>
                <span className="format-name" dir="ltr">
                  {f.name}
                </span>
                <span className="format-body">{f.body}</span>
              </li>
            ))}
          </Reveal>
          <Reveal index={2}>
            <figure className="code-window" aria-label={t.ship.previewLabel} dir="ltr">
              <div className="code-window-bar">
                <span className="frame-dot" />
                <span className="frame-dot" />
                <span className="frame-dot" />
              </div>
              <div className="code-window-panes">
                <div className="code-pane">
                  <p className="code-pane-label">{t.ship.codeLabel}</p>
                  <pre>
                    <code>{SAMPLE_DESIGN_MD}</code>
                  </pre>
                </div>
                <div className="code-pane">
                  <p className="code-pane-label">{t.ship.tokensLabel}</p>
                  <pre>
                    <code>{SAMPLE_TOKENS}</code>
                  </pre>
                </div>
              </div>
            </figure>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ set up */}
      <section className="band" aria-labelledby="install">
        <div className="wrap">
          <Reveal className="band-head">
            <p className="eyebrow">{t.installEyebrow}</p>
            <h2 id="install" tabIndex={-1}>
              {t.installTitle}
            </h2>
            <p className="band-lead">{t.installLead}</p>
          </Reveal>
          <Reveal index={1} className="install-url">
            <CodeBlock
              code={url}
              label={t.serverUrlLabel}
              labelLang={labelLang}
              copyLabel={t.copy.address}
              labels={copyLabels}
              testId="code-server-url"
            />
          </Reveal>
          <div className="install-grid">
            <Reveal as="article" index={1} className="panel" aria-labelledby="install-claude">
              <h3 id="install-claude">{t.clients.claude.title}</h3>
              <ol>
                {t.clients.claude.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <CodeBlock
                code={claudeCmd}
                label={t.clients.claude.codeLabel}
                labelLang={labelLang}
                copyLabel={t.copy.command}
                labels={copyLabels}
                testId="code-claude"
              />
            </Reveal>
            <Reveal as="article" index={2} className="panel" aria-labelledby="install-chatgpt">
              <h3 id="install-chatgpt">{t.clients.chatgpt.title}</h3>
              <ol>
                {t.clients.chatgpt.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </Reveal>
            <Reveal as="article" index={3} className="panel" aria-labelledby="install-cursor">
              <h3 id="install-cursor">{t.clients.cursor.title}</h3>
              <ol>
                {t.clients.cursor.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <CodeBlock
                code={cursorJson}
                label={t.clients.cursor.codeLabel}
                copyLabel={t.copy.config}
                labels={copyLabels}
                testId="code-cursor"
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section className="band" aria-labelledby="pricing-title">
        <div className="wrap">
          <Reveal className="band-head is-center">
            <p className="eyebrow">{t.pricing.eyebrow}</p>
            <h2 id="pricing-title">{t.pricing.title}</h2>
            <p className="band-lead">{beta ? t.pricing.lead : t.pricing.leadPaid}</p>
          </Reveal>
          <Reveal index={1}>
            <PricingToggle
              className="plans-scope"
              labels={{ period: t.pricing.period, monthly: t.pricing.monthly, yearly: t.pricing.yearly, save: t.pricing.yearlySave }}
            >
              <ul className="plans">
                <li className="plan">
                  <h3>{p.plans.free.name}</h3>
                  <p className="plan-price">
                    <span dir="ltr">{free.amount}</span> <small>{free.period}</small>
                  </p>
                  <p className="plan-blurb">{p.plans.free.blurb}</p>
                  <ul className="feature-list">
                    {planFeatures("free", p).map((f) => (
                      <li key={f}>
                        <CheckIcon size={16} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <a className="st-btn plan-cta" data-variant="secondary" data-size="lg" href="#install">
                    {t.pricing.ctaFree}
                  </a>
                </li>
                <li className="plan is-pro">
                  <div className="plan-head">
                    <h3>{p.proName}</h3>
                    <span className="st-chip" data-tone="ship">
                      {beta ? t.pricing.betaChip : t.pricing.popular}
                    </span>
                  </div>
                  <p className="plan-price period-month">
                    <span dir="ltr">{monthly.amount}</span> <small>{monthly.period}</small>
                  </p>
                  <p className="plan-price period-year">
                    <span dir="ltr">{yearly.amount}</span> <small>{yearly.period}</small>
                  </p>
                  <p className="plan-blurb">{p.plans.pro_monthly.blurb}</p>
                  <ul className="feature-list">
                    {planFeatures("pro_monthly", p).map((f) => (
                      <li key={f}>
                        <CheckIcon size={16} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link className="st-btn plan-cta" data-variant="secondary" data-size="lg" href={href(locale, "pricing")}>
                    {t.pricing.cta}
                  </Link>
                </li>
              </ul>
            </PricingToggle>
          </Reveal>
          <Reveal index={2}>
            <p className="plans-note">{t.pricing.founding}</p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section className="band" aria-labelledby="faq-title">
        <div className="wrap faq">
          <div className="faq-head">
            <Reveal>
              <p className="eyebrow">{t.faq.eyebrow}</p>
              <h2 id="faq-title">{t.faq.title}</h2>
            </Reveal>
          </div>
          <div className="faq-list">
            {t.faq.items.map((item, i) => (
              <Reveal key={item.q} index={i % 3} className="faq-item">
                <h3>{fmt(item.q)}</h3>
                <p>{fmt(item.a)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ final call */}
      <section className="final" aria-labelledby="final-title">
        <div className="wrap">
          <Reveal blur>
            <h2 id="final-title">{t.final.title}</h2>
          </Reveal>
          <Reveal index={1}>
            <p className="band-lead">{fmt(t.final.lead)}</p>
            <div className="actions">
              <a className="st-btn" data-variant="primary" data-size="lg" href="#install">
                {t.ctaAdd}
                <ArrowEndIcon size={16} />
              </a>
              <Link className="st-btn" data-variant="secondary" data-size="lg" href={href(locale, "pricing")}>
                {t.final.ctaPricing}
              </Link>
            </div>
            <p className="final-note">{beta ? t.final.note : t.final.notePaid}</p>
          </Reveal>
        </div>
      </section>
    </>
  );
}
