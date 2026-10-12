/**
 * Add to Claude as a window (WindowLayer, kind "settings"), for both ways it opens: over the page
 * whose Add to Claude link opened it (@modal/(.)install) or over the home page on a direct load
 * (page.tsx). One plugin brings the connector and the skills; the tabs cover the Claude app
 * (add the GitHub marketplace), a plugin file to upload (public/downloads, packed on every build
 * by scripts/build-plugin-zip.mjs), Claude Code, and any other MCP client (the server address).
 */
import { WindowLayer } from "@/components/window/WindowLayer";
import { APP_NAME, getConfig } from "@/lib/config";
import { getDict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";
import { CodeBlock } from "../../../../_components/CodeBlock";
import { docsHref } from "../../../../_components/desktop/Dock";
import { FrameLights } from "../../../../_components/desktop/FrameLights";
import { Window } from "../../../../_components/desktop/Window";
import { ServerAddress } from "../../../../_components/ServerAddress";
import { InstallTabs } from "./InstallTabs";
import "./install.css";

/** The GitHub repository that holds the plugin marketplace (.claude-plugin/marketplace.json). */
const PLUGIN_REPO = "MaherFayad/GoBanana";
const PLUGIN_ZIP = "/downloads/gobanana-plugin.zip";

export function InstallWindow({ locale, mode }: { locale: Locale; mode: "overlay" | "home" }) {
  const dict = getDict(locale);
  const t = dict.install;
  const copy = dict.landing.copy;
  const labels = { done: copy.done, doneBody: copy.doneBody, failed: copy.failed, failedBody: copy.failedBody };
  const title = fmt(t.windowTitle, { app: APP_NAME });
  const w = dict.landing.desk.window;
  const url = getConfig().mcpResourceUrl ?? "https://YOUR-DOMAIN/api/mcp";
  const steps = (list: readonly string[]) => (
    <ol className="inst-steps">
      {list.map((s, i) => (
        <li key={i}>{fmt(s, { app: APP_NAME })}</li>
      ))}
    </ol>
  );

  return (
    <WindowLayer mode={mode} kind="settings" label={title} closeHref={href(locale)} escapeCloses>
      <Window
        as="div"
        title={title}
        className="install"
        bodyClassName="install-body"
        lights={<FrameLights title={title} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />}
      >
        <h1 className="inst-title">{title}</h1>
        <p className="inst-lead">{fmt(t.lead, { app: APP_NAME })}</p>
        <InstallTabs
          label={t.tabsLabel}
          tabs={[
            {
              id: "app",
              label: t.tabs.app,
              panel: (
                <>
                  <p>{t.app.intro}</p>
                  {steps(t.app.steps)}
                  <CodeBlock code={PLUGIN_REPO} label={t.app.repoLabel} labelLang={locale} copyLabel={copy.address} labels={labels} testId="install-repo" variant="file" />
                  <p className="inst-note">{fmt(t.app.note, { app: APP_NAME })}</p>
                </>
              ),
            },
            {
              id: "file",
              label: t.tabs.file,
              panel: (
                <>
                  <p>{t.file.intro}</p>
                  {steps(t.file.steps)}
                  <a className="st-btn" data-variant="primary" data-size="md" href={PLUGIN_ZIP} download>
                    {t.file.download}
                  </a>
                </>
              ),
            },
            {
              id: "code",
              label: t.tabs.code,
              panel: (
                <>
                  <p>{t.code.intro}</p>
                  <CodeBlock
                    code={`/plugin marketplace add ${PLUGIN_REPO}\n/plugin install gobanana@gobanana`}
                    label={t.code.label}
                    copyLabel={copy.command}
                    labels={labels}
                    testId="install-code"
                    variant="terminal"
                  />
                </>
              ),
            },
            {
              id: "other",
              label: t.tabs.other,
              panel: (
                <>
                  <p>{t.other.intro}</p>
                  <ServerAddress url={url} label={dict.landing.serverUrlLabel} hint={dict.landing.serverUrlHint} copyLabel={copy.address} labels={labels} />
                  <a className="inst-docs" href={docsHref(locale, "setup/overview/")}>
                    {t.other.docs}
                  </a>
                </>
              ),
            },
          ]}
        />
      </Window>
    </WindowLayer>
  );
}
