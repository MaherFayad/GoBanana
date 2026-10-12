/**
 * The dock, small and neutral like the reference: home, your canvases, the docs and pricing. Fixed to the bottom centre on every
 * width; on phones it respects safe-area-inset-bottom. Each item's name is real text, shown as a
 * label above the icon on hover and focus, so the name is never only a tooltip. Arabic mirrors
 * the order through the flex direction (the page is rtl).
 */
import { BrandMark } from "@/components/brand/BrandMark";
import { CanvasesIcon, ChecklistIcon, DocsIcon, type IconComponent } from "@/components/studio/icons";
import type { Dict } from "@/lib/site/dict";
import { fmt, href, type Locale } from "@/lib/site/i18n";

export const DOCS_HREF = "/docs/";

/** Docs live at /docs (English) and /docs/ar/ (Arabic), built from banana-docs. */
export function docsHref(locale: string, page = ""): string {
  return `${DOCS_HREF}${locale === "ar" ? "ar/" : ""}${page}`;
}

export function Dock({ locale, t }: { locale: Locale; t: Dict }) {
  const d = t.landing.desk.dock;
  const home = href(locale);
  const items: { href: string; label: string; Icon: IconComponent | null }[] = [
    { href: home, label: fmt(d.home), Icon: null },
    { href: href(locale, "canvases"), label: t.common.nav.canvases, Icon: CanvasesIcon },
    { href: docsHref(locale), label: d.docs, Icon: DocsIcon },
    { href: href(locale, "pricing"), label: d.pricing, Icon: ChecklistIcon },
  ];
  return (
    <nav className="dock" aria-label={d.label}>
      <ul className="dock-list">
        {items.map(({ href: to, label, Icon }, i) => (
          <li key={to} className={i === 0 ? "dock-item is-home" : "dock-item"}>
            <a className="dock-link" href={to}>
              <span className="dock-icon" aria-hidden="true">
                {Icon ? <Icon size={24} /> : <BrandMark />}
              </span>
              <span className="dock-label">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
