/** Landing page: /en and /ar. "/" stays with app/page.tsx and can redirect here. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_NAME, getConfig } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale } from "@/lib/site/i18n";
import { CodeBlock } from "../_components/CodeBlock";

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

/** Server name for client configs, derived from APP_NAME ("Banana" -> "banana"). */
function serverName(): string {
  return APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "design";
}

export default async function LandingPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale).landing;
  const url = mcpUrl();
  const name = serverName();
  const claudeCmd = `claude mcp add --transport http ${name} ${url}`;
  const cursorJson = JSON.stringify({ mcpServers: { [name]: { url } } }, null, 2);
  // Code labels and copy buttons follow the page language; the code itself is always ltr.
  const labelLang = locale === "ar" ? "ar" : undefined;
  const copyLabels = { done: t.copy.done, doneBody: t.copy.doneBody, failed: t.copy.failed, failedBody: t.copy.failedBody };

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">{fmt(t.heroTitle)}</h1>
        <p className="lead">{fmt(t.heroLead)}</p>
        <div className="actions">
          <a className="st-btn" data-variant="primary" data-size="lg" href="#install">
            {fmt(t.ctaInstall)}
          </a>
          <Link className="st-btn" data-variant="secondary" data-size="lg" href={href(locale, "pricing")}>
            {t.ctaPricing}
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title">{t.howTitle}</h2>
        <ol className="st-tile-grid">
          {t.steps.map((step, i) => (
            <li key={step.title} className="st-tile">
              <p className="st-tile-title" data-accent="3">
                {fmt(t.stepLabel, { n: i + 1 })}
              </p>
              <h3>{step.title}</h3>
              <p>{fmt(step.body)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="video-title">
        <h2 id="video-title">{t.videoTitle}</h2>
        <figure className="video-slot">
          {/*
            TODO(M8): replace the placeholder with the 20-second canvas video:
            <video controls muted playsInline preload="metadata" poster="/video/canvas-poster.jpg">
              <source src="/video/canvas.mp4" type="video/mp4" />
              <track kind="captions" src="/video/canvas.<locale>.vtt" srcLang={locale} label=... default />
            </video>
            No autoplay (SC 2.2.2). Keep the figcaption as the text alternative (SC 1.2.1).
          */}
          <div className="video-frame">
            <p>{t.videoPending}</p>
          </div>
          <figcaption>{t.videoCaption}</figcaption>
        </figure>
      </section>

      <section aria-labelledby="install">
        <h2 id="install" tabIndex={-1}>
          {t.installTitle}
        </h2>
        <p>{t.installLead}</p>
        <div className="alert-gap">
          <CodeBlock
            code={url}
            label={t.serverUrlLabel}
            labelLang={labelLang}
            copyLabel={t.copy.address}
            labels={copyLabels}
            testId="code-server-url"
          />
        </div>
        <div className="st-tile-grid wide">
          <article className="st-tile" aria-labelledby="install-claude">
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
          </article>
          <article className="st-tile" aria-labelledby="install-chatgpt">
            <h3 id="install-chatgpt">{t.clients.chatgpt.title}</h3>
            <ol>
              {t.clients.chatgpt.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </article>
          <article className="st-tile" aria-labelledby="install-cursor">
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
          </article>
        </div>
      </section>

      <section aria-labelledby="promise-title">
        <h2 id="promise-title">{fmt(t.promiseTitle)}</h2>
        <ul>
          {t.promises.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      {/* Payments are off for the beta (DECISIONS.md), so the founding offer is shown as coming later
          with no buy button. */}
      <section aria-labelledby="founding-title" className="st-tile-grid feature-tile">
        <div className="st-tile">
          <div className="tile-head">
            <h2 id="founding-title">{t.foundingTitle}</h2>
            <span className="st-chip" data-tone="explore">
              {t.foundingChip}
            </span>
          </div>
          <p>{t.foundingBody}</p>
          <div>
            <Link className="st-btn" data-variant="secondary" data-size="lg" href={`${href(locale, "pricing")}#founding`}>
              {t.foundingCta}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
