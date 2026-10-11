/**
 * Landing page: /en and /ar. "/" stays with app/page.tsx and redirects here.
 *
 * Structure and behavior after pryzm.design (owner decision, DECISIONS.md): a draggable field
 * of tiles in the hero, then the product in a window frame, a graph of the flow, a gallery, the
 * export, set up, pricing, FAQ, a final call to action and the footer, with scroll reveals.
 * The look is GoBanana's own: Studio tokens, light and dark, Inter and IBM Plex Sans Arabic,
 * the yellow primary button and Pixelarticons.
 *
 * Every section shows something (owner feedback, 2026-10-11): the hero and gallery show real,
 * published references, hotlinked with the creator and source link on each (lib/site/showcase.ts,
 * filtered by the takedown list, generative art when the list cannot load or an image fails);
 * the export section previews the six files export_kit really writes; set up shows where to click
 * in each agent; pricing, FAQ and the final call to action get their own small pictures.
 *
 * Rendered per request, so the takedown filter always applies (one cached list read, no Serper).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowEndIcon,
  CanvasesIcon,
  ChatIcon,
  LinkIcon,
  PlugIcon,
  SearchIcon,
  ShieldIcon,
  SparkleIcon,
  TerminalIcon,
  type IconComponent,
} from "@/components/studio/icons";
import { APP_NAME, getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { memoTakedowns } from "@/lib/db/takedowns";
import { betaPlan } from "@/lib/quota";
import { getDict, type Dict } from "@/lib/site/dict";
import { exportPreview } from "@/lib/site/export-demo";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { GALLERY_BOARDS, HERO_TILES } from "@/lib/site/moves";
import { planFeatureItems, priceText } from "@/lib/site/plans";
import { FINAL_REFS, GALLERY_REFS, HERO_REFS, showcaseIndex, siteName, type ShowcaseItem } from "@/lib/site/showcase";
import { loadShowcase } from "@/lib/site/showcase-load";
import { compileTakedowns } from "@/lib/takedown";
import { e2eAuthBypass } from "@/lib/web-auth";
import { bidi, bt } from "../../_components/Bidi";
import { ClaudeMark, CursorMark } from "../../_components/BrandMarks";
import { CodeBlock } from "../../_components/CodeBlock";
import { ExportTabs } from "../../_components/ExportTabs";
import { GalleryBoard, type BoardRef } from "../../_components/GalleryBoard";
import { GraphWires } from "../../_components/GraphWires";
import { HeroField, type TileRef } from "../../_components/HeroField";
import { ChatGptMock, ClaudeConnectorMock } from "../../_components/InstallMocks";
import { BetaBadge, PlanFeatureList } from "../../_components/PlanBits";
import { PricingToggle } from "../../_components/PricingToggle";
import { ProductFrame } from "../../_components/ProductFrame";
import { RefImage } from "../../_components/RefImage";
import { Reveal } from "../../_components/Reveal";
import { ServerAddress } from "../../_components/ServerAddress";
import { TileArt } from "../../_components/TileArt";
import "../../_components/landing.css";

// Per request: the showcase goes through the takedown list on every render (hard rule 5).
export const dynamic = "force-dynamic";

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

/**
 * The visible showcase, or null (fail closed: generative art) when the takedown list cannot load.
 * The E2E sign-in bypass (never on in a production build) has no database, so it checks against
 * an empty list.
 */
async function visibleShowcase(): Promise<ShowcaseItem[] | null> {
  const loadMatcher =
    e2eAuthBypass() && !process.env.DATABASE_URL ? async () => compileTakedowns([]) : () => memoTakedowns(getRepos().takedowns)();
  return loadShowcase({ loadMatcher });
}

/** Words for showcase items in one language. */
function showcaseWords(t: Dict["landing"], locale: Locale) {
  const sc = t.showcase;
  const credit = (item: ShowcaseItem): ReactNode =>
    item.creator ? bt(sc.credit, { creator: item.creator, site: siteName(item.sourceSite) }) : <bdi dir="ltr">{siteName(item.sourceSite)}</bdi>;
  const what = (item: ShowcaseItem): ReactNode => {
    const lens = sc.lenses[item.lens];
    return item.move ? bt(sc.what, { move: sc.moves[item.move], lens }) : lens;
  };
  // Source titles are English; Arabic pages mark the alt text as such.
  const altLang = locale === "ar" ? "en" : undefined;
  const tileRef = (item: ShowcaseItem): TileRef => ({ src: item.thumbUrl, alt: item.title, altLang, href: item.sourceUrl, credit: credit(item), what: what(item) });
  const boardRef = (item: ShowcaseItem | undefined): BoardRef | null =>
    item ? { src: item.thumbUrl, alt: item.title, altLang, href: item.sourceUrl, credit: credit(item), title: item.title } : null;
  return { credit, what, altLang, tileRef, boardRef };
}

const BOARD_KEYS = ["souq", "transit", "loud", "private"] as const;

/** One icon per FAQ question, in dictionary order. */
const FAQ_ICONS: IconComponent[] = [SparkleIcon, SearchIcon, LinkIcon, PlugIcon, CanvasesIcon, ShieldIcon];

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
        <span className="graph-deco graph-deco-files">
          {["DESIGN.md", "tokens.json", "theme.css"].map((f) => (
            <span key={f}>
              <bdi dir="ltr">{f}</bdi>
            </span>
          ))}
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
  const dir = locale === "ar" ? "rtl" : "ltr";

  const url = mcpUrl();
  const name = serverName();
  const claudeCmd = `claude mcp add --transport http ${name} ${url}`;
  const cursorJson = JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2);
  // Code labels and copy buttons follow the page language; the code itself is always ltr.
  const labelLang = locale === "ar" ? "ar" : undefined;
  const copyLabels = { done: t.copy.done, doneBody: t.copy.doneBody, failed: t.copy.failed, failedBody: t.copy.failedBody };

  const items = await visibleShowcase();
  const refs = items ? showcaseIndex(items) : null;
  const words = showcaseWords(t, locale);

  const tiles = HERO_TILES.map((tile, i) => {
    const move = t.moves[i]!;
    const item = refs?.get(HERO_REFS[tile.art]);
    return {
      ...tile,
      ...move,
      caption: fmt(t.field.caption, { name: move.name, color: move.color }),
      ...(item ? { ref: words.tileRef(item) } : {}),
    };
  });
  const finalRefs = refs ? FINAL_REFS.map((id) => refs.get(id)).filter((i): i is ShowcaseItem => i !== undefined) : [];
  const graphMoves = t.moves.slice(0, 6).map((m) => m.move).filter((m, i, all) => all.indexOf(m) === i);
  const monthly = priceText("pro_monthly", p);
  const yearly = priceText("pro_yearly", p);
  const free = priceText("free", p);
  const files = exportPreview();
  const c = t.clients;

  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero" aria-labelledby="hero-title">
        <HeroField
          tiles={tiles}
          dir={dir}
          labels={{
            label: t.field.label,
            hint: refs ? t.field.hintRefs : t.field.hint,
            sample: t.field.sample,
            twist: t.field.twist,
            close: t.field.close,
            moveLabel: t.field.moveLabel,
            idea: t.field.idea,
            openSource: t.field.openSource,
            newTab: t.field.newTab,
          }}
        />
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
              <p className="hero-lead">{bt(t.heroLead)}</p>
              <div className="actions">
                <a className="st-btn" data-variant="primary" data-size="lg" href="#install">
                  {bidi(t.ctaAdd)}
                  <ArrowEndIcon size={16} />
                </a>
                <a className="st-btn" data-variant="secondary" data-size="lg" href="#gallery">
                  {t.ctaExample}
                </a>
              </div>
              {refs ? (
                <p className="hero-notice">
                  {t.showcase.notice} <Link href={href(locale, "takedown")}>{t.showcase.noticeLink}</Link>
                </p>
              ) : null}
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
            <p className="band-lead">{bt(t.graph.lead)}</p>
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
                    <p>{bidi(node.body)}</p>
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
              {bt(t.gallery.title)}
            </h2>
            <p className="band-lead">{refs ? t.gallery.lead : t.gallery.leadArt}</p>
          </Reveal>
          <ul className="gallery">
            {t.gallery.cards.map((card, i) => (
              <Reveal as="li" key={card.title} index={i} className="gallery-card">
                <GalleryBoard
                  index={i}
                  board={BOARD_KEYS[i]!}
                  title={card.title}
                  body={bidi(card.body)}
                  twist={bidi(card.twist)}
                  tags={card.tags}
                  palette={card.palette}
                  arts={GALLERY_BOARDS[i]!}
                  refs={refs ? GALLERY_REFS[i]!.map((id) => words.boardRef(refs.get(id))) : null}
                  labels={{
                    openExample: t.gallery.openExample,
                    exampleEyebrow: t.gallery.exampleEyebrow,
                    twist: t.gallery.twist,
                    paletteLabel: t.gallery.paletteLabel,
                    paletteTitle: t.gallery.paletteTitle,
                    sources: t.showcase.sources,
                    sourcesTitle: t.gallery.sourcesTitle,
                    newTab: t.field.newTab,
                    close: dict.common.close,
                  }}
                />
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
              <p className="band-lead">{bidi(t.ship.lead)}</p>
            </Reveal>
            <Reveal index={1} className="ship-cta">
              <a className="st-btn" data-variant="secondary" data-size="lg" href="#install">
                {bidi(t.ship.cta)}
                <ArrowEndIcon size={16} />
              </a>
            </Reveal>
          </div>
          <Reveal index={1}>
            <ExportTabs
              label={t.ship.tabsLabel}
              tabs={files.map((f, i) => ({
                format: f.format,
                label: bidi(t.ship.formats[i]!.label),
                body: bidi(t.ship.formats[i]!.body),
                fileName: f.name,
                content: f.content,
                windowLabel: fmt(t.ship.windowLabel, { file: f.name }),
              }))}
            />
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
            <p className="band-lead">{bidi(t.installLead)}</p>
          </Reveal>
          <Reveal index={1} className="install-url">
            <ServerAddress url={url} label={t.serverUrlLabel} hint={t.serverUrlHint} copyLabel={t.copy.address} labels={copyLabels} />
          </Reveal>
          <div className="install-grid">
            <Reveal as="article" index={1} className="install-card" aria-labelledby="install-claude">
              <ClientHead id="install-claude" title={c.claudeApp.title} mark={<ClaudeMark size={20} />} />
              <ClaudeConnectorMock t={c.claudeApp} url={url} name={name} />
              <Steps steps={c.claudeApp.steps} />
            </Reveal>
            <Reveal as="article" index={2} className="install-card" aria-labelledby="install-claude-code">
              <ClientHead id="install-claude-code" title={c.claudeCode.title} mark={<ClaudeMark size={20} />} badge={<TerminalIcon size={16} />} />
              <CodeBlock
                code={claudeCmd}
                label={c.claudeCode.codeLabel}
                labelLang={labelLang}
                copyLabel={t.copy.command}
                labels={copyLabels}
                testId="code-claude"
                variant="terminal"
              />
              <Steps steps={c.claudeCode.steps} />
            </Reveal>
            <Reveal as="article" index={1} className="install-card" aria-labelledby="install-chatgpt">
              <ClientHead id="install-chatgpt" title={c.chatgpt.title} mark={<ChatIcon size={24} />} />
              <ChatGptMock t={c.chatgpt} url={url} name={name} />
              <Steps steps={c.chatgpt.steps} />
            </Reveal>
            <Reveal as="article" index={2} className="install-card" aria-labelledby="install-cursor">
              <ClientHead id="install-cursor" title={c.cursor.title} mark={<CursorMark size={20} />} />
              <CodeBlock
                code={cursorJson}
                label={c.cursor.codeLabel}
                copyLabel={t.copy.config}
                labels={copyLabels}
                testId="code-cursor"
                variant="file"
              />
              <Steps steps={c.cursor.steps} />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section className="band" aria-labelledby="pricing-title">
        <div className="wrap">
          <Reveal className="band-head is-center">
            <p className="eyebrow">{t.pricing.eyebrow}</p>
            <h2 id="pricing-title">{bidi(t.pricing.title)}</h2>
            <p className="band-lead">{bidi(beta ? t.pricing.lead : t.pricing.leadPaid)}</p>
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
                    <bdi className="plan-amount" dir="ltr">{free.amount}</bdi> <small>{free.period}</small>
                  </p>
                  <p className="plan-blurb">{p.plans.free.blurb}</p>
                  <PlanFeatureList items={planFeatureItems("free", p)} />
                  <a className="st-btn plan-cta" data-variant="secondary" data-size="lg" href="#install">
                    {bidi(t.pricing.ctaFree)}
                  </a>
                </li>
                <li className="plan is-pro">
                  <div className="plan-head">
                    <h3>{bidi(p.proName)}</h3>
                    {beta ? (
                      <BetaBadge>{bidi(t.pricing.betaBadge)}</BetaBadge>
                    ) : (
                      <span className="st-chip" data-tone="ship">
                        {t.pricing.popular}
                      </span>
                    )}
                  </div>
                  <p className="plan-price period-month">
                    <bdi className="plan-amount" dir="ltr">{monthly.amount}</bdi> <small>{monthly.period}</small>
                  </p>
                  <p className="plan-price period-year">
                    <bdi className="plan-amount" dir="ltr">{yearly.amount}</bdi> <small>{yearly.period}</small>
                  </p>
                  <p className="plan-blurb">{p.plans.pro_monthly.blurb}</p>
                  <PlanFeatureList items={planFeatureItems("pro_monthly", p)} />
                  <Link className="st-btn plan-cta" data-variant="secondary" data-size="lg" href={href(locale, "pricing")}>
                    {t.pricing.cta}
                  </Link>
                </li>
              </ul>
            </PricingToggle>
          </Reveal>
          <Reveal index={2}>
            <p className="plans-note">{bidi(t.pricing.founding)}</p>
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
            {t.faq.items.map((item, i) => {
              const Icon = FAQ_ICONS[i] ?? SparkleIcon;
              return (
                <Reveal key={item.q} index={i % 3} className="faq-item">
                  <span className="faq-icon" aria-hidden="true">
                    <Icon size={24} />
                  </span>
                  <div className="faq-text">
                    <h3>{bt(item.q)}</h3>
                    <p>{bt(item.a)}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ final call */}
      <section className="final" aria-labelledby="final-title">
        <div className="wrap">
          {finalRefs.length > 0 ? (
            <Reveal className="final-collage-wrap">
              <ul className="final-collage" aria-label={t.showcase.collageLabel}>
                {finalRefs.map((item, i) => (
                  <li key={item.id} className="final-tile" style={{ "--i": i } as CSSProperties}>
                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                      <span className="final-art">
                        <RefImage src={item.thumbUrl} alt={item.title} lang={words.altLang} art={HERO_TILES[i % HERO_TILES.length]!.art} uid={`final-${i}`} />
                      </span>
                      <span className="final-credit">{words.credit(item)}</span>
                      <span className="st-visually-hidden"> ({t.field.newTab})</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Reveal>
          ) : null}
          <Reveal blur>
            <h2 id="final-title">{t.final.title}</h2>
          </Reveal>
          <Reveal index={1}>
            <p className="band-lead">{bt(t.final.lead)}</p>
            <div className="actions">
              <a className="st-btn" data-variant="primary" data-size="lg" href="#install">
                {bidi(t.ctaAdd)}
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

/** Logo and name of an agent on its set-up card. */
function ClientHead({ id, title, mark, badge }: { id: string; title: string; mark: ReactNode; badge?: ReactNode }) {
  return (
    <div className="install-card-head">
      <span className="install-logo" aria-hidden="true">
        {mark}
        {badge ? <span className="install-logo-badge">{badge}</span> : null}
      </span>
      <h3 id={id}>{bidi(title)}</h3>
    </div>
  );
}

/** Numbered steps as circles on a line. */
function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s}>{bidi(s)}</li>
      ))}
    </ol>
  );
}
