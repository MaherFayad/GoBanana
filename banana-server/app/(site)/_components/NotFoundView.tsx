/**
 * The 404 page on the GoBanana desktop (docs/site-redesign-spec.md): one glass "Trash" window
 * saying the file has moved to the Trash, one short line, and a way home or to the docs. The
 * window sits in the middle of the first screen; the footer starts below the fold. Both
 * languages; Arabic mirrors through logical CSS.
 */
import { ArrowEndIcon, DocsIcon, TrashIcon } from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";
import { href, type Locale } from "@/lib/site/i18n";
import { docsHref } from "./desktop/Dock";
import { RollButton } from "./desktop/RollButton";
import { TwoToneHeading } from "./desktop/TwoToneHeading";
import { Window } from "./desktop/Window";

export function NotFoundView({ locale, t }: { locale: Locale; t: Dict["notFound"] }) {
  return (
    <div className="nf">
      <Window
        as="div"
        title={t.windowTitle}
        className="nf-window"
        bodyClassName="nf-panel"
        toolbar={
          <span className="nf-code" dir="ltr">
            {t.code}
          </span>
        }
      >
        <span className="nf-icon" aria-hidden="true">
          <TrashIcon size={24} />
        </span>
        <TwoToneHeading as="h1" className="is-window nf-title" dim={t.titleDim} bright={t.titleBright} />
        <p className="nf-body">{t.body}</p>
        <div className="actions nf-actions">
          <RollButton href={href(locale)} variant="primary" icon={<ArrowEndIcon size={16} />}>
            {t.primary}
          </RollButton>
          <RollButton href={docsHref(locale)} plain icon={<DocsIcon size={16} />}>
            {t.secondary}
          </RollButton>
        </div>
      </Window>
    </div>
  );
}
