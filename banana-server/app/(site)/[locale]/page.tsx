/** Landing page: /en and /ar. "/" stays with app/page.tsx and can redirect here. */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { APP_NAME, getConfig } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { fmt, href, isLocale } from "@/lib/site/i18n";

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

  return (
    <>
      <section aria-labelledby="hero-title">
        <h1 id="hero-title">{fmt(t.heroTitle)}</h1>
        <p className="lead">{fmt(t.heroLead)}</p>
        <div className="actions">
          <a className="button" href="#install">
            {t.ctaInstall}
          </a>
          <Link className="button secondary" href={href(locale, "pricing")}>
            {t.ctaPricing}
          </Link>
        </div>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title">{t.howTitle}</h2>
        <ol className="grid steps">
          {t.steps.map((step) => (
            <li key={step.title} className="card">
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
        <pre tabIndex={0} aria-label={t.serverUrlLabel}>
          <code>{url}</code>
        </pre>
        <div className="grid">
          <article className="card" aria-labelledby="install-claude">
            <h3 id="install-claude">{t.clients.claude.title}</h3>
            <ol>
              {t.clients.claude.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <pre tabIndex={0} aria-label="Claude Code">
              <code>{claudeCmd}</code>
            </pre>
          </article>
          <article className="card" aria-labelledby="install-chatgpt">
            <h3 id="install-chatgpt">{t.clients.chatgpt.title}</h3>
            <ol>
              {t.clients.chatgpt.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </article>
          <article className="card" aria-labelledby="install-cursor">
            <h3 id="install-cursor">{t.clients.cursor.title}</h3>
            <ol>
              {t.clients.cursor.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <pre tabIndex={0} aria-label="~/.cursor/mcp.json">
              <code>{cursorJson}</code>
            </pre>
          </article>
        </div>
        <p className="note">{t.copyHint}</p>
      </section>

      <section aria-labelledby="promise-title">
        <h2 id="promise-title">{fmt(t.promiseTitle)}</h2>
        <ul>
          {t.promises.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="founding-title" className="card highlight">
        <h2 id="founding-title" style={{ marginBlockStart: 0 }}>
          {t.foundingTitle}
        </h2>
        <p>{t.foundingBody}</p>
        <Link className="button" href={`${href(locale, "pricing")}#founding`}>
          {t.foundingCta}
        </Link>
      </section>
    </>
  );
}
