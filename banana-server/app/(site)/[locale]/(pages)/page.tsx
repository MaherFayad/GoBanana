/**
 * Landing page: /en and /ar. "/" stays with app/page.tsx and redirects here.
 *
 * A scroll story after ssscript.app (docs/landing-motion-spec.md). The persistent layer: the menu
 * bar and dock (layout), a fixed notification stack, and a fixed stage behind everything with the
 * 3D Bend tile, the desk background and the mouse glyph trail (StoryStage). Scroll motion (Lenis,
 * GSAP ScrollTrigger: word blur-ins, the pinned board row, the export fan, the file pile) loads
 * on demand in StoryMotion, and none of it runs under prefers-reduced-motion.
 *
 * Sections, in order: the hero desktop (the "Add GoBanana" window, four callouts, reference icons
 * with Quick Look), one board, made with GoBanana (the board row), three statements, the FAQ as a
 * Mail window, Brief. Bend. Ship., pricing as a table window, the grey export section with windows
 * fanning out of the mark, the file pile and the last call, then the footer.
 *
 * Every section carries `data-mark="scale y dim"` for the stage: how big the tile is, where it sits
 * (fraction of the viewport height) and how bright it is while that section is in the middle.
 *
 * References are real, published work, hotlinked with the creator and source link on each
 * (lib/site/showcase.ts, filtered by the takedown list per request).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand/BrandMark";
import { ArrowEndIcon } from "@/components/studio/icons";
import { FOUNDING_CAP } from "@/lib/billing/paddle";
import { PLAN_ORDER } from "@/lib/billing/plans";
import { APP_NAME, getConfig } from "@/lib/config";
import { getRepos } from "@/lib/db";
import { memoTakedowns } from "@/lib/db/takedowns";
import { betaPlan, PLAN_LIMITS, type Plan } from "@/lib/quota";
import { getDict, type Dict } from "@/lib/site/dict";
import { en } from "@/lib/site/dict/en";
import kitPreview from "@/lib/site/kit-preview.json";
import { fmt, href, isLocale, type Locale } from "@/lib/site/i18n";
import { GALLERY_BOARDS, HERO_TILES } from "@/lib/site/moves";
import { priceText } from "@/lib/site/plans";
import { GALLERY_REFS, HERO_REFS, showcaseIndex, siteName, type ShowcaseItem } from "@/lib/site/showcase";
import { loadShowcase } from "@/lib/site/showcase-load";
import { compileTakedowns } from "@/lib/takedown";
import { e2eAuthBypass } from "@/lib/web-auth";
import { bidi, bt } from "../../_components/Bidi";
import { DesktopIcons, type DeskIcon } from "../../_components/desktop/DesktopIcons";
import { docsHref } from "../../_components/desktop/Dock";
import { MailApp } from "../../_components/desktop/MailApp";
import { NotificationStack, type Notice } from "../../_components/desktop/NotificationStack";
import { RollButton } from "../../_components/desktop/RollButton";
import { Window } from "../../_components/desktop/Window";
import { GalleryBoard, type BoardRef } from "../../_components/GalleryBoard";
import { ProductFrame } from "../../_components/ProductFrame";
import { ServerAddress } from "../../_components/ServerAddress";
import { LanguageSwitch } from "../../_components/SiteNav";
import { BoardRow } from "../../_components/story/BoardRow";
import { StoryMotion } from "../../_components/story/StoryMotion";
import { StoryStage } from "../../_components/story/StoryStage";
import "../../_components/landing.css";
import "../../_components/story/story.css";

// Per request: the showcase goes through the takedown list on every render (hard rule 5).
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: { absolute: fmt(getDict(locale).landing.title) } };
}

function mcpUrl(): string {
  return getConfig().mcpResourceUrl ?? "https://YOUR-DOMAIN/api/mcp";
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

const BOARD_KEYS = ["souq", "transit", "loud", "private"] as const;
/** Where each export window lands, in rem from the middle of the stage (mirrored in Arabic). */
const FAN = [
  { x: -22, y: -9 },
  { x: -10, y: -5 },
  { x: 2, y: -1 },
  { x: 14, y: 3 },
  { x: 24, y: 8 },
];

const kebab = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** File names for the pile: the gallery boards and the showcase lenses (always Latin file names). */
function pileNames(): string[] {
  const boards = en.landing.gallery.cards.map((c) => `${kebab(c.title)}.board`);
  const refs = Object.values(en.landing.showcase.lenses).map((l) => `${kebab(l)}.ref`);
  const out: string[] = [];
  for (let i = 0; out.length < boards.length + refs.length; i++) {
    if (i < refs.length) out.push(refs[i]!);
    if (i < boards.length) out.push(boards[i]!);
  }
  return out;
}

/** A heading in lines: the first `dim` lines grey, the rest white. One heading for screen readers. */
function Lines({
  as: Tag = "h2",
  id,
  lines,
  dim = 1,
  className,
  reveal = true,
}: {
  as?: "h1" | "h2" | "h3";
  id?: string;
  lines: ReactNode[];
  dim?: number;
  className?: string;
  reveal?: boolean;
}) {
  return (
    <Tag id={id} tabIndex={id ? -1 : undefined} className={className ? `tt ${className}` : "tt"} data-reveal={reveal ? "" : undefined}>
      {lines.map((l, i) => (
        <span key={i} className={i < dim ? "tt-dim" : "tt-bright"}>
          {l}
          {i < lines.length - 1 ? " " : null}
        </span>
      ))}
    </Tag>
  );
}

type AddProps = { t: Dict["landing"]; locale: Locale; url: string; level: "h2" | "h3" };

/** Inside the "Add GoBanana" window: the tile, the two-tone title, one line, the address and Copy. */
function AddBody({ t, locale, url, level }: AddProps) {
  const s = t.story.add;
  const copyLabels = { done: t.copy.done, doneBody: t.copy.doneBody, failed: t.copy.failed, failedBody: t.copy.failedBody };
  return (
    <>
      <span className="add-mark" aria-hidden="true">
        <BrandMark />
      </span>
      <Lines as={level} className="is-window" lines={[bt(s.dim), bidi(s.bright)]} reveal={false} />
      <p className="add-lead">{bidi(s.lead)}</p>
      <ServerAddress url={url} label={t.serverUrlLabel} hint={t.serverUrlHint} copyLabel={t.copy.address} labels={copyLabels} />
      <a className="add-guide" href={docsHref(locale, "start/install/")}>
        {s.guide}
        <ArrowEndIcon size={16} />
      </a>
    </>
  );
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const t = dict.landing;
  const s = t.story;
  const d = t.desk;
  const p = dict.pricing;
  const beta = betaPlan() !== null;
  const url = mcpUrl();

  const items = await visibleShowcase();
  const refs = items ? showcaseIndex(items) : null;
  const altLang = locale === "ar" ? "en" : undefined;
  const credit = (item: ShowcaseItem): ReactNode =>
    item.creator ? bt(t.showcase.credit, { creator: item.creator, site: siteName(item.sourceSite) }) : <bdi dir="ltr">{siteName(item.sourceSite)}</bdi>;
  const boardRef = (item: ShowcaseItem | undefined): BoardRef | null =>
    item ? { src: item.thumbUrl, alt: item.title, altLang, href: item.sourceUrl, credit: credit(item), title: item.title } : null;

  const icons: DeskIcon[] = [];
  if (refs) {
    for (const tile of HERO_TILES) {
      const item = refs.get(HERO_REFS[tile.art]);
      if (!item) continue;
      const lens = t.showcase.lenses[item.lens];
      const what = item.move ? bt(t.showcase.what, { move: t.showcase.moves[item.move], lens }) : lens;
      icons.push({ id: tile.art, src: item.thumbUrl, title: item.title, altLang, art: tile.art, href: item.sourceUrl, credit: credit(item), what });
      if (icons.length === 4) break;
    }
  }

  const monthly = priceText("pro_monthly", p).amount;
  const yearly = priceText("pro_yearly", p).amount;
  const founding = priceText("founding", p).amount;
  const notices: Notice[] = [
    { href: href(locale, "canvases"), title: s.notes.canvases.title, body: s.notes.canvases.body, when: s.notes.canvases.when },
    ...(beta ? [{ href: href(locale, "pricing"), title: s.notes.beta.title, body: s.notes.beta.body, when: s.notes.beta.when }] : []),
    {
      href: `${href(locale, "pricing")}#founding`,
      title: s.notes.founding.title,
      body: fmt(s.notes.founding.body, { price: founding, cap: FOUNDING_CAP }),
      when: s.notes.founding.when,
    },
  ];

  const faqItems = s.faq.items.map((item, i) => ({
    q: bt(item.q),
    a: bt(i === 3 && beta ? `${item.a} ${s.faq.costBeta}` : item.a, { monthly }),
  }));

  // Precomputed by the real exporters (lib/site/export-demo.ts `kitPreview`); keeps yaml out of this chunk.
  const files = kitPreview;
  const pile = pileNames();
  const yesNo = (v: boolean) => (v ? p.yes : p.no);
  const planCta = (plan: Plan) =>
    plan === "free" ? (
      <RollButton href="#install" size="md" variant="secondary">
        {bidi(s.pricing.ctaFree)}
      </RollButton>
    ) : (
      <RollButton href={plan === "founding" ? `${href(locale, "pricing")}#founding` : href(locale, "pricing")} size="md" variant={plan === "pro_monthly" ? "primary" : "ghost"}>
        {s.pricing.ctaPaid}
      </RollButton>
    );
  const rows: { label: string; value: (plan: Plan) => ReactNode }[] = [
    {
      label: p.rows.price,
      value: (plan) => {
        const pr = priceText(plan, p);
        return (
          <>
            <bdi dir="ltr">{pr.amount}</bdi> {pr.period}
          </>
        );
      },
    },
    { label: p.rows.searches, value: (plan) => PLAN_LIMITS[plan].searchesPerMonth },
    { label: p.rows.canvases, value: (plan) => (Number.isFinite(PLAN_LIMITS[plan].canvases) ? PLAN_LIMITS[plan].canvases : p.unlimited) },
    { label: p.rows.items, value: (plan) => PLAN_LIMITS[plan].itemsPerCanvas },
    { label: p.rows.share, value: (plan) => yesNo(PLAN_LIMITS[plan].shareLinks) },
    { label: p.rows.exports, value: (plan) => bidi(plan === "free" ? p.exportsFree : p.exportsAll) },
  ];

  const f = dict.common.footer;
  const home = href(locale);
  const footerColumns = [
    {
      title: f.product,
      links: [
        { href: `${home}#how`, label: f.howItWorks },
        { href: `${home}#gallery`, label: f.gallery },
        { href: href(locale, "pricing"), label: f.pricing },
        { href: href(locale, "canvases"), label: f.canvases },
      ],
    },
    {
      title: f.help,
      links: [
        { href: docsHref(locale), label: f.docs },
        { href: docsHref(locale, "start/install/"), label: f.setup },
        { href: href(locale, "account"), label: f.account },
        { href: href(locale, "takedown"), label: f.takedown },
      ],
    },
    {
      title: f.legal,
      links: [
        { href: href(locale, "terms"), label: f.terms },
        { href: href(locale, "privacy"), label: f.privacy },
      ],
    },
  ];
  const other: Locale = locale === "ar" ? "en" : "ar";

  return (
    <div className="story">
      <StoryStage />
      <StoryMotion />
      <NotificationStack label={d.notifications.label} from={fmt(d.notifications.from)} items={notices} />

      {/* ------------------------------------------------------------ 1. the desktop */}
      <section className="s-hero" aria-labelledby="hero-title" data-mark="1 0.53 1">
        <div className="hero-head">
          <Lines as="h1" id="hero-title" className="is-hero" lines={[bidi(s.hero.dim), bidi(s.hero.bright)]} reveal={false} />
          <p className="story-lead">{bidi(s.hero.lead)}</p>
          <div className="actions">
            <RollButton href="#install" variant="primary" icon={<ArrowEndIcon size={16} />}>
              {bidi(s.hero.add)}
            </RollButton>
            <RollButton href="#gallery" variant="ghost">
              {s.hero.boards}
            </RollButton>
          </div>
        </div>
        {s.callouts.map((c, i) => (
          <div key={c.dim} className="callout" data-callout={i}>
            <Lines as="h2" className="is-callout" lines={[bidi(c.dim), bidi(c.bright)]} reveal={false} />
            <p>{bidi(c.body)}</p>
          </div>
        ))}
        <div className="hero-window">
          <Window id="install" title={fmt(s.add.dim)} titleNode={bidi(fmt(s.add.dim))} className="add-window is-frost" controls labels={d.window}>
            <AddBody t={t} locale={locale} url={url} level="h2" />
          </Window>
        </div>
        {icons.length > 0 ? (
          <div className="hero-icons">
            <DesktopIcons
              icons={icons}
              labels={{ label: d.icons.label, quickLook: d.icons.quickLook, openSource: t.field.openSource, newTab: t.field.newTab, window: d.window }}
            />
          </div>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ 2. one board */}
      <section className="s-board" aria-labelledby="canvas" data-mark="0.9 0.55 1">
        <div className="board-text">
          <Lines id="canvas" lines={[bidi(s.board.dim), bidi(s.board.bright)]} />
          <ul className="board-notes">
            {s.board.notes.map((n) => (
              <li key={n.title} data-reveal="">
                <span className="note-k">{n.title}</span> <span>{bidi(n.body)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="board-window" data-parallax="">
          <Window as="div" title={s.board.window} titleNode={<bdi dir="ltr">{s.board.window}</bdi>} className="is-frame is-frost" id="board-win" controls labels={d.window}>
            <ProductFrame t={t.frame} />
          </Window>
        </div>
      </section>

      {/* ------------------------------------------------------------ 3. made with */}
      <section className="s-made" aria-labelledby="gallery" data-mark="1 0.42 1">
        <div className="made-head">
          <p className="story-lead" data-reveal="">
            {bidi(s.made.lead)}
          </p>
          <Lines id="gallery" lines={[bidi(s.made.dim), bt(s.made.bright)]} />
        </div>
        <BoardRow label={s.made.label} prev={s.made.prev} next={s.made.next}>
          {t.gallery.cards.map((card, i) => (
            <li key={card.title} className="row-card gallery-card">
              <GalleryBoard
                index={i}
                board={BOARD_KEYS[i]!}
                title={card.title}
                body={bidi(card.body)}
                twist={bidi(card.twist)}
                tags={card.tags}
                palette={card.palette}
                arts={GALLERY_BOARDS[i]!}
                refs={refs ? GALLERY_REFS[i]!.map((id) => boardRef(refs.get(id))) : null}
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
            </li>
          ))}
        </BoardRow>
        {refs ? (
          <p className="made-notice">
            {t.showcase.notice} <Link href={href(locale, "takedown")}>{t.showcase.noticeLink}</Link>
          </p>
        ) : null}
      </section>

      {/* ------------------------------------------------------------ 4. three statements */}
      <section className="s-how" aria-labelledby="how" data-mark="0.85 0.55 1">
        <h2 id="how" tabIndex={-1} className="st-visually-hidden">
          {d.dock.how}
        </h2>
        {s.statements.map((st, i) => (
          <div key={st.dim} className="statement" data-side={i % 2 ? "end" : "start"}>
            <Lines as="h3" className="is-statement" lines={[bidi(st.dim), bidi(st.bright)]} />
            <p className="story-lead" data-reveal="">
              {bidi(st.body)}
            </p>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------------------ 5. FAQ (Mail) */}
      <section className="s-faq" aria-labelledby="faq" data-mark="0.62 0.58 1">
        <div className="faq-head">
          <Lines id="faq" lines={[bidi(s.faq.dim), bidi(s.faq.bright)]} />
          <RollButton href={docsHref(locale)} plain size="md" variant="secondary">
            {s.faq.docs}
          </RollButton>
        </div>
        <div data-parallax="">
          <Window as="div" title={s.faq.window} titleNode={<bdi dir="ltr">{s.faq.window}</bdi>} className="is-mail is-frost" id="faq-win" controls labels={d.window}>
            <MailApp
              items={faqItems}
              avatar={<BrandMark />}
              labels={{ inbox: d.mail.inbox, listLabel: d.mail.listLabel, from: APP_NAME, to: s.faq.replyTo, count: fmt(d.mail.count, { n: faqItems.length }) }}
            />
          </Window>
        </div>
      </section>

      {/* ------------------------------------------------------------ 6. brief, bend, ship */}
      <section className="s-ship" aria-labelledby="ship" data-mark="0.6 0.56 1">
        <Lines id="ship" className="is-big" lines={s.ship.lines.map((l) => bidi(l))} dim={2} />
        <div className="ship-side">
          <p className="story-lead" data-reveal="">
            {bt(s.ship.lead)}
          </p>
          <RollButton href="#install" variant="primary" icon={<ArrowEndIcon size={16} />}>
            {bidi(s.hero.add)}
          </RollButton>
        </div>
      </section>

      {/* ------------------------------------------------------------ 7. pricing */}
      <section className="s-pricing" aria-labelledby="pricing" data-mark="0.55 0.62 0.3">
        <p className="eyebrow">{s.pricing.eyebrow}</p>
        <Lines id="pricing" className="is-huge" lines={s.pricing.lines.map((l) => bidi(l))} />
        <div className="pricing-lines">
          {beta ? <p data-reveal="">{bidi(s.pricing.beta)}</p> : null}
          <p data-reveal="">{bidi(fmt(s.pricing.pro, { monthly, yearly }))}</p>
          <p data-reveal="">{bidi(fmt(s.pricing.founding, { founding, cap: FOUNDING_CAP }))}</p>
        </div>
        <div data-parallax="">
          <Window as="div" title={s.pricing.window} titleNode={<bdi dir="ltr">{s.pricing.window}</bdi>} className="is-pricing is-frost" id="pricing-win" controls labels={d.window}>
            <div className="price-table-wrap" tabIndex={0} role="region" aria-label={p.compareTitle}>
              <table className="price-table">
                <caption className="st-visually-hidden">{p.compareCaption}</caption>
                <thead>
                  <tr>
                    <td />
                    {PLAN_ORDER.map((plan) => (
                      <th key={plan} scope="col">
                        {bidi(p.plans[plan].name)}
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
                  <tr className="price-cta">
                    <td />
                    {PLAN_ORDER.map((plan) => (
                      <td key={plan}>{planCta(plan)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="price-cards">
              {PLAN_ORDER.map((plan) => (
                <li key={plan}>
                  <h3>{bidi(p.plans[plan].name)}</h3>
                  <dl>
                    {rows.map((r) => (
                      <div key={r.label}>
                        <dt>{r.label}</dt>
                        <dd>{r.value(plan)}</dd>
                      </div>
                    ))}
                  </dl>
                  {planCta(plan)}
                </li>
              ))}
            </ul>
            <p className="price-fine">{bidi(s.pricing.fine)}</p>
          </Window>
        </div>
      </section>

      {/* ------------------------------------------------------------ 8. the grey export section */}
      <section className="s-kit" aria-labelledby="kit" data-grey="" data-mark="0.62 0.56 1">
        <div className="kit-gap" />
        <div className="kit-pin">
          <div className="kit-sticky">
            <Lines id="kit" className="is-grey" lines={[bidi(s.kit.dim), bidi(s.kit.bright)]} />
            <ul className="kit-fan" data-fan="" aria-label={s.kit.label}>
              {files.map((file, i) => (
                <li key={file.name} className="fan-win" style={{ ["--x" as string]: FAN[i]!.x, ["--y" as string]: FAN[i]!.y, ["--i" as string]: i }}>
                  <Window as="div" title={file.name} titleNode={<bdi dir="ltr">{file.name}</bdi>} className="is-kit">
                    <pre dir="ltr" translate="no">
                      <code>{file.content}</code>
                    </pre>
                  </Window>
                </li>
              ))}
            </ul>
            <ul className="kit-files" aria-hidden="true">
              {["brief.md", "palette.json"].map((n) => (
                <li key={n} className="kit-file">
                  <span className="file-glyph" />
                  <bdi dir="ltr">{n}</bdi>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="kit-gap" />
      </section>

      {/* ------------------------------------------------------------ 9. your next direction */}
      <section className="s-next" aria-labelledby="next" data-mark="0.6 0.56 0.5">
        <div className="next-text">
          <Lines id="next" className="is-huge" lines={[bidi(s.next.dim), bidi(s.next.bright)]} />
          {beta ? (
            <p className="story-lead" data-reveal="">
              {bidi(s.next.note)}
            </p>
          ) : null}
        </div>
        <ul className="pile" data-pile="" aria-hidden="true">
          {pile.map((n, i) => (
            <li key={`${n}-${i}`}>
              <span className="file-glyph" />
              <bdi dir="ltr">{n}</bdi>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ 10. add again, footer */}
      <section className="s-end" aria-labelledby="end-title" data-mark="0.6 0.64 1">
        <h2 id="end-title" className="st-visually-hidden">
          {fmt(s.add.dim)}
        </h2>
        <Window as="div" title={fmt(s.add.dim)} titleNode={bidi(fmt(s.add.dim))} className="add-window is-frost" id="install-end" controls labels={d.window}>
          <AddBody t={t} locale={locale} url={url} level="h3" />
        </Window>
      </section>

      <footer className="story-footer">
        <div className="sf-brand">
          <Link className="sf-logo" href={home} dir="ltr">
            <span className="sf-tile" aria-hidden="true">
              <BrandMark />
            </span>
            <span className="sf-name">{APP_NAME}</span>
          </Link>
          <p>
            <bdi dir="ltr">{fmt(f.rights, { year: new Date().getUTCFullYear() })}</bdi>
          </p>
          <p className="sf-note">{bt(f.note)}</p>
          <LanguageSwitch to={other} label={dict.common.language.label} name={dict.common.language.switchTo} />
        </div>
        <nav className="sf-columns" aria-label={dict.common.footerLabel}>
          {footerColumns.map((col) => (
            <div key={col.title} className="sf-col">
              <h2 className="sf-title">{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href.startsWith("/docs/") ? (
                      <a href={l.href}>{l.label}</a>
                    ) : (
                      <Link href={l.href}>{l.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </footer>
    </div>
  );
}
