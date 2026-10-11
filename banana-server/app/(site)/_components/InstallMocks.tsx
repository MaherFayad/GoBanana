/**
 * Small pictures of where to click in each agent, for the set-up cards: Claude's "Add custom
 * connector" dialog and ChatGPT's developer mode with a new connector, both with the server
 * address filled in. Built from Studio tokens and shapes, never a screenshot or the clients'
 * own artwork, and markup only: one accessible name each (role="img"), nothing to focus.
 * The words follow the page language, like the steps next to them.
 */
import { ChevronEndIcon, CursorIcon } from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";

type Clients = Dict["landing"]["clients"];

export function ClaudeConnectorMock({ t, url, name }: { t: Clients["claudeApp"]; url: string; name: string }) {
  const m = t.mock;
  return (
    <div className="client-mock" role="img" aria-label={t.label}>
      <div className="cm-inner" aria-hidden="true">
        <div className="cm-crumbs">
          <span>{m.settings}</span>
          <ChevronEndIcon size={12} />
          <span className="is-here">{m.connectors}</span>
        </div>
        <div className="cm-dialog">
          <p className="cm-title">{m.dialogTitle}</p>
          <span className="cm-label">{m.name}</span>
          <span className="cm-input">
            <bdi dir="ltr">{name}</bdi>
          </span>
          <span className="cm-label">{m.url}</span>
          <span className="cm-input is-filled">
            <bdi dir="ltr">{url}</bdi>
          </span>
          <span className="cm-actions">
            <span className="cm-btn">{m.cancel}</span>
            <span className="cm-btn is-primary">
              {m.add}
              <span className="cm-pointer">
                <CursorIcon size={16} />
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function ChatGptMock({ t, url, name }: { t: Clients["chatgpt"]; url: string; name: string }) {
  const m = t.mock;
  return (
    <div className="client-mock" role="img" aria-label={t.label}>
      <div className="cm-inner" aria-hidden="true">
        <div className="cm-row">
          <span className="cm-row-title">{m.advanced}</span>
        </div>
        <div className="cm-row">
          <span>{m.devMode}</span>
          <span className="cm-toggle" data-on="" />
        </div>
        <div className="cm-dialog">
          <p className="cm-title">{m.newConnector}</p>
          <span className="cm-input">
            <bdi dir="ltr">{name}</bdi>
          </span>
          <span className="cm-label">{m.url}</span>
          <span className="cm-input is-filled">
            <bdi dir="ltr">{url}</bdi>
          </span>
          <span className="cm-label">{m.auth}</span>
          <span className="cm-input">
            <bdi dir="ltr">{m.oauth}</bdi>
          </span>
          <span className="cm-actions">
            <span className="cm-btn is-primary">
              {m.create}
              <span className="cm-pointer">
                <CursorIcon size={16} />
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
