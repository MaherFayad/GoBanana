/**
 * Landing page: /en and /ar. "/" stays with app/page.tsx and redirects here.
 *
 * The GoBanana desktop (docs/site-redesign-spec.md, owner decision 2026-10-12): a black, grainy
 * desktop with a menu bar (SiteChrome), the hero as an "Add to Claude" window over the Bend mark
 * in glass, four corner callouts, desktop icons of real references (Quick Look windows), a
 * notification stack and a dock. Below it, every section is a glass window with a two-tone
 * heading: the canvas, the graph, the gallery as a Finder window, recordings, the export kit as
 * a text editor, set up, pricing as plan windows, the FAQ as a Mail app and the final call.
 * Under 768px it becomes a phone home screen (desktop.css): stacked full-width windows, no drag.
 *
 * The hero and gallery show real, published references, hotlinked with the creator and source
 * link on each (lib/site/showcase.ts, filtered by the takedown list, generative art when the list
 * cannot load or an image fails). Rendered per request, so the takedown filter always applies.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ArrowEndIcon, ChatIcon, TerminalIcon } from "@/components/studio/icons";
import { APP_NAME, getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { memoTakedowns } from "@/lib/db/takedowns";
import { betaPlan } from "@/lib/quota";
import { getDict, type Dict } from "@/lib/site/dict";
import { exportPreview } from "@/lib/site/export-demo";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { GALLERY_BOARDS, HERO_TILES, type ArtKind } from "@/lib/site/moves";
import { planFeatureItems, priceText } from "@/lib/site/plans";
import { FINAL_REFS, GALLERY_REFS, HERO_REFS, showcaseIndex, siteName, type ShowcaseItem } from "@/lib/site/showcase";
import { loadShowcase } from "@/lib/site/showcase-load";
import { compileTakedowns } from "@/lib/takedown";
import { e2eAuthBypass } from "@/lib/web-auth";
import { bidi, bt } from "../../_components/Bidi";
import { ClaudeMark, CursorMark } from "../../_components/BrandMarks";
import { CodeBlock } from "../../_components/CodeBlock";
import { ClipSlider } from "../../_components/desktop/ClipSlider";
import { DesktopIcons, type DeskIcon } from "../../_components/desktop/DesktopIcons";
import { GlassMark } from "../../_components/desktop/GlassMark";
import { MailApp } from "../../_components/desktop/MailApp";
import { NotificationStack, type Notice } from "../../_components/desktop/NotificationStack";
import { RollButton } from "../../_components/desktop/RollButton";
import { splitTitle, TwoToneHeading } from "../../_components/desktop/TwoToneHeading";
import { Window } from "../../_components/desktop/Window";
import { ExportTabs } from "../../_components/ExportTabs";
import { GalleryBoard, type BoardRef } from "../../_components/GalleryBoard";
import { GraphWires } from "../../_components/GraphWires";
import type { TileRef } from "../../_components/HeroField";
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

/** Posters for the recordings until they exist (GoBanana's own art). */
const CLIP_ARTS: ArtKind[] = ["sadu", "halftone", "swiss", "grain", "iridescent", "blueprint"];

/** A corner callout on the hero desktop: a small two-tone heading and one line of copy. */
function Callout({ c, i }: { c: Dict["landing"]["desk"]["callouts"][number]; i: number }) {
  return (
    <div className="callout" data-callout={i}>
      <TwoToneHeading as="h2" className="is-callout" dim={bidi(c.dim)} bright={bidi(c.bright)} />
      <p>{bt(c.body)}</p>
    </div>
  );
}

/** Section heading on the desk: two tones, an optional lead. */
function DeskHead({ id, h, lead, center }: { id: string; h: { dim: string; bright: string }; lead?: ReactNode; center?: boolean }) {
  return (
    <Reveal className={center ? "desk-head is-center" : "desk-head"}>
      <TwoToneHeading id={id} tabIndex={-1} dim={bt(h.dim)} bright={bt(h.bright)} />
      {lead ? <p className="desk-lead">{lead}</p> : null}
    </Reveal>
  );
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.landing;
  const d = t.desk;
  const p = dict.pricing;
  const beta = betaPlan() !== null;

  const url = mcpUrl();
  const name = serverName();
  const claudeCmd = `claude mcp add --transport http ${name} ${url}`;
  const cursorJson = JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2);
  // Code labels and copy buttons follow the page language; the code itself is always ltr.
  const labelLang = locale === "ar" ? "ar" : undefined;
  const copyLabels = { done: t.copy.done, doneBody: t.copy.doneBody, failed: t.copy.failed, failedBody: t.copy.failedBody };
  const windowLabels = d.window;

  const items = await visibleShowcase();
  const refs = items ? showcaseIndex(items) : null;
  const words = showcaseWords(t, locale);

  const icons: DeskIcon[] = [];
  if (refs) {
    for (const tile of HERO_TILES) {
      const item = refs.get(HERO_REFS[tile.art]);
      if (!item) continue;
      const r: TileRef = words.tileRef(item);
      icons.push({ id: tile.art, src: r.src, title: item.title, altLang: r.altLang, art: tile.art, href: r.href, credit: r.credit, what: r.what });
      if (icons.length === 4) break;
    }
  }
  const notices: Notice[] = [
    { href: href(locale, "canvases"), title: t.heroChip, body: d.notifications.canvasesBody, when: d.notifications.now },
    beta
      ? { href: href(locale, "pricing"), title: p.betaAllTitle, body: p.betaAllBody, when: d.notifications.beta }
      : { href: `${href(locale, "pricing")}#founding`, title: p.plans.founding.name, body: t.pricing.founding, when: d.notifications.now },
  ];

  const finalRefs = refs ? FINAL_REFS.map((id) => refs.get(id)).filter((i): i is ShowcaseItem => i !== undefined) : [];
  const graphMoves = t.moves.slice(0, 6).map((m) => m.move).filter((m, i, all) => all.indexOf(m) === i);
  const monthly = priceText("pro_monthly", p);
  const yearly = priceText("pro_yearly", p);
  const free = priceText("free", p);
  const files = exportPreview();
  const c = t.clients;
  const [heroDim, heroBright] = splitTitle(t.heroTitle);

  return (
    <div className="desk">
      {/* ------------------------------------------------------------ the desktop */}
      <section className="desk-hero" aria-labelledby="hero-title">
        <GlassMark />
        <div className="desk-hero-grid">
          <div className="desk-col is-start">
            <div className="callout is-hero">
              <TwoToneHeading as="h1" id="hero-title" className="is-hero" dim={heroDim} bright={heroBright} />
              <p className="desk-lead">{bt(t.heroLead)}</p>
              <div className="actions">
                <RollButton href="#install" variant="primary" icon={<ArrowEndIcon size={16} />}>
                  {bidi(t.ctaAdd)}
                </RollButton>
                <RollButton href="#gallery">{t.ctaExample}</RollButton>
              </div>
            </div>
            <Callout c={d.callouts[0]!} i={0} />
            <Callout c={d.callouts[1]!} i={1} />
          </div>

          <div className="desk-center">
            <Window id="add-window" title={d.add.windowTitle} titleNode={bidi(d.add.windowTitle)} className="add-window" controls labels={windowLabels}>
              <span className="add-mark" aria-hidden="true">
                <BrandMark />
              </span>
              <TwoToneHeading as="h2" className="is-window" dim={bt(d.add.title)} bright={d.add.titleBright} />
              <p className="add-lead">{bidi(d.add.lead)}</p>
              <ServerAddress url={url} label={t.serverUrlLabel} hint={t.serverUrlHint} copyLabel={t.copy.address} labels={copyLabels} />
              <p className="add-steps-title">{bidi(d.add.stepsTitle)}</p>
              <Steps steps={c.claudeApp.steps} />
              <p className="add-more">
                <a href="#install">{d.add.more}</a>
              </p>
              {refs ? (
                <p className="add-fine">
                  {t.showcase.notice} <Link href={href(locale, "takedown")}>{t.showcase.noticeLink}</Link>
                </p>
              ) : null}
            </Window>
          </div>

          <div className="desk-col is-end">
            <NotificationStack label={d.notifications.label} from={fmt(d.notifications.from)} items={notices} />
            {icons.length > 0 ? (
              <DesktopIcons
                icons={icons}
                labels={{ label: d.icons.label, quickLook: d.icons.quickLook, openSource: t.field.openSource, newTab: t.field.newTab, window: windowLabels }}
              />
            ) : null}
            <Callout c={d.callouts[2]!} i={2} />
            <Callout c={d.callouts[3]!} i={3} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ the canvas */}
      <section className="desk-section" aria-labelledby="canvas">
        <div className="wrap">
          <DeskHead id="canvas" h={d.sections.canvas} lead={t.frame.lead} />
          <Reveal index={1}>
            <Window as="div" title={d.windows.canvas} className="is-frame">
              <ProductFrame t={t.frame} />
            </Window>
          </Reveal>
          <Reveal index={2} className="band-foot">
            <RollButton href={href(locale, "canvases")} variant="ghost" icon={<ArrowEndIcon size={16} />}>
              {t.frame.cta}
            </RollButton>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ graph */}
      <section className="desk-section" aria-labelledby="how">
        <div className="wrap">
          <DeskHead id="how" h={d.sections.graph} lead={bt(t.graph.lead)} />
          <Reveal index={1}>
            <Window as="div" title={d.windows.graph} className="is-graph">
              <div className="graph">
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
              </div>
            </Window>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ gallery (Finder) */}
      <section className="desk-section" aria-labelledby="gallery">
        <div className="wrap">
          <DeskHead id="gallery" h={d.sections.gallery} lead={refs ? t.gallery.lead : t.gallery.leadArt} />
          <Window
            as="div"
            title={d.windows.gallery}
            className="is-finder"
            toolbar={<span className="dwin-count">{fmt(d.windows.galleryCount, { n: t.gallery.cards.length })}</span>}
          >
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
          </Window>
        </div>
      </section>

      {/* ------------------------------------------------------------ recordings */}
      <section className="desk-section" aria-labelledby="clips">
        <div className="wrap">
          <DeskHead id="clips" h={d.sections.clips} lead={d.clips.lead} />
          <Reveal index={1}>
            <ClipSlider
              clips={d.clips.items.map((caption, i) => ({ caption, art: CLIP_ARTS[i % CLIP_ARTS.length]! }))}
              labels={{ label: d.clips.label, prev: d.clips.prev, next: d.clips.next, play: d.clips.play, pause: d.clips.pause, soon: d.clips.soon }}
            />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ export (text editor) */}
      <section className="desk-section" aria-labelledby="ship-title">
        <div className="wrap">
          <DeskHead id="ship-title" h={d.sections.export} lead={bidi(t.ship.lead)} />
          <Reveal index={1}>
            <Window as="div" title={d.windows.export} className="is-editor">
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
            </Window>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ set up */}
      <section className="desk-section" aria-labelledby="install">
        <div className="wrap">
          <DeskHead id="install" h={d.sections.setup} lead={bidi(t.installLead)} />
          <Reveal index={1} className="install-url">
            <ServerAddress url={url} label={t.serverUrlLabel} hint={t.serverUrlHint} copyLabel={t.copy.address} labels={copyLabels} />
          </Reveal>
          <div className="install-grid">
            <Reveal index={1}>
              <Window as="article" title={c.claudeApp.title} aria-labelledby="install-claude" className="is-install" bodyClassName="install-card">
                <ClientHead id="install-claude" title={c.claudeApp.title} mark={<ClaudeMark size={20} />} />
                <ClaudeConnectorMock t={c.claudeApp} url={url} name={name} />
                <Steps steps={c.claudeApp.steps} />
              </Window>
            </Reveal>
            <Reveal index={2}>
              <Window as="article" title={c.claudeCode.title} aria-labelledby="install-claude-code" className="is-install" bodyClassName="install-card">
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
              </Window>
            </Reveal>
            <Reveal index={1}>
              <Window as="article" title={c.chatgpt.title} aria-labelledby="install-chatgpt" className="is-install" bodyClassName="install-card">
                <ClientHead id="install-chatgpt" title={c.chatgpt.title} mark={<ChatIcon size={24} />} />
                <ChatGptMock t={c.chatgpt} url={url} name={name} />
                <Steps steps={c.chatgpt.steps} />
              </Window>
            </Reveal>
            <Reveal index={2}>
              <Window as="article" title={c.cursor.title} aria-labelledby="install-cursor" className="is-install" bodyClassName="install-card">
                <ClientHead id="install-cursor" title={c.cursor.title} mark={<CursorMark size={20} />} />
                <CodeBlock code={cursorJson} label={c.cursor.codeLabel} copyLabel={t.copy.config} labels={copyLabels} testId="code-cursor" variant="file" />
                <Steps steps={c.cursor.steps} />
              </Window>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ pricing (plan windows) */}
      <section className="desk-section" aria-labelledby="pricing-title">
        <div className="wrap">
          <DeskHead id="pricing-title" center h={d.sections.pricing} lead={bidi(beta ? t.pricing.lead : t.pricing.leadPaid)} />
          <Reveal index={1}>
            <PricingToggle
              className="plans-scope"
              labels={{ period: t.pricing.period, monthly: t.pricing.monthly, yearly: t.pricing.yearly, save: t.pricing.yearlySave }}
            >
              <ul className="plans desk-plans">
                <li>
                  <Window as="div" title={p.plans.free.name} className="is-plan" bodyClassName="plan">
                    <h3>{p.plans.free.name}</h3>
                    <p className="plan-price">
                      <bdi className="plan-amount" dir="ltr">{free.amount}</bdi> <small>{free.period}</small>
                    </p>
                    <p className="plan-blurb">{p.plans.free.blurb}</p>
                    <PlanFeatureList items={planFeatureItems("free", p)} />
                    <RollButton href="#install" className="plan-cta">
                      {bidi(t.pricing.ctaFree)}
                    </RollButton>
                  </Window>
                </li>
                <li>
                  <Window as="div" title={p.proName} className="is-plan is-pro-win" bodyClassName="plan is-pro">
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
                    <RollButton href={href(locale, "pricing")} variant="primary" className="plan-cta">
                      {t.pricing.cta}
                    </RollButton>
                  </Window>
                </li>
              </ul>
            </PricingToggle>
          </Reveal>
          <Reveal index={2}>
            <p className="plans-note">{bidi(t.pricing.founding)}</p>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ FAQ (Mail) */}
      <section className="desk-section" aria-labelledby="faq-title">
        <div className="wrap">
          <DeskHead id="faq-title" h={d.sections.faq} />
          <Reveal index={1}>
            <Window as="div" title={d.windows.faq} className="is-mail">
              <MailApp
                items={t.faq.items.map((item) => ({ q: bt(item.q), a: bt(item.a) }))}
                labels={{ inbox: d.mail.inbox, listLabel: d.mail.listLabel, from: fmt(d.mail.from), to: d.mail.to, count: fmt(d.mail.count, { n: t.faq.items.length }) }}
              />
            </Window>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ final call */}
      <section className="final desk-final" aria-labelledby="final-title">
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
          <Reveal>
            <TwoToneHeading id="final-title" className="is-final" dim={d.final.kicker} bright={t.final.title} />
          </Reveal>
          <Reveal index={1}>
            <p className="desk-lead">{bt(t.final.lead)}</p>
            <div className="actions">
              <RollButton href="#install" variant="primary" icon={<ArrowEndIcon size={16} />}>
                {bidi(t.ctaAdd)}
              </RollButton>
              <RollButton href={href(locale, "pricing")}>{t.final.ctaPricing}</RollButton>
            </div>
            <p className="final-note">{beta ? t.final.note : t.final.notePaid}</p>
          </Reveal>
        </div>
      </section>
    </div>
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
