"use client";

/**
 * Culture chip (CULT-02): a small "Culture" button on an image tile or note that opens a dialog
 * with the tradition, its meaning, the credit and the care tier. Works in the web canvas and the
 * inline canvas (both render these nodes). English and Arabic: the labels follow the page
 * language (`<html lang>`), the item text is shown as written with dir="auto". The dialog is the
 * studio Dialog (native modal: focus trap, Escape, focus back to the chip), so the whole path
 * works from the keyboard.
 */
import { useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/studio/Dialog";
import { TIER_LABEL, type Culture } from "@/lib/culture";

type Lang = "en" | "ar";

const COPY = {
  en: {
    chip: "Culture",
    chipFor: (t: string) => `Culture: ${t}`,
    title: "Cultural context",
    tradition: "Tradition",
    region: "Region",
    community: "Community",
    tier: "Care tier",
    meaning: "Meaning",
    credit: "Credit",
    source: "Source",
    close: "Close",
    newTab: "(opens in a new tab)",
    tierNote: { open: "Open to draw from. Credit the source.", care: "Needs care. Ask a reviewer from the community.", sacred: "Sacred. Never use as decoration." },
  },
  ar: {
    chip: "الثقافة",
    chipFor: (t: string) => `الثقافة: ${t}`,
    title: "السياق الثقافي",
    tradition: "التقليد",
    region: "المنطقة",
    community: "المجتمع",
    tier: "مستوى العناية",
    meaning: "المعنى",
    credit: "الفضل لـ",
    source: "المصدر",
    close: "إغلاق",
    newTab: "(يفتح في تبويب جديد)",
    tierNote: { open: "مفتوح للاستلهام. اذكر المصدر.", care: "يحتاج عناية. اسأل مراجع من المجتمع.", sacred: "مقدس. لا تستخدمه للزخرفة أبدًا." },
  },
} as const;

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  return () => observer.disconnect();
}

/** "ar" when the page language is Arabic, else "en". */
function useLang(): Lang {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.lang.toLowerCase().startsWith("ar") ? "ar" : "en"),
    () => "en",
  );
}

export function CultureChip({ culture }: { culture: Culture }) {
  const [open, setOpen] = useState(false);
  const lang = useLang();
  const t = COPY[lang];
  const rows: [string, string, boolean][] = [
    [t.tradition, culture.tradition, false],
    [t.region, culture.region, false],
    ...(culture.community ? ([[t.community, culture.community, false]] as [string, string, boolean][]) : []),
    [t.tier, `${TIER_LABEL[culture.tier][lang]}. ${t.tierNote[culture.tier]}`, false],
    [t.meaning, culture.meaning, true],
    [t.credit, culture.credit, true],
  ];
  return (
    <>
      <button
        type="button"
        className="st-chip bn-chip bn-culture-chip nodrag nopan"
        data-tone="neutral"
        data-tier={culture.tier}
        data-testid="culture-chip"
        aria-haspopup="dialog"
        aria-label={t.chipFor(culture.tradition)}
        lang={lang}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span>{t.chip}</span>
      </button>
      {/* The dialog sits inside the tile in the DOM: keep its clicks from reaching the tile (preview, select). */}
      <div
        style={{ display: "contents" }}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={<span lang={lang}>{t.title}</span>}
        size="md"
        className="bn-culture-dialog"
        closeLabel={t.close}
      >
        <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-testid="culture-details">
          <dl className="bn-culture-list">
            {rows.map(([label, value, auto]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd dir={auto ? "auto" : undefined}>{value}</dd>
              </div>
            ))}
            {culture.sourceUrl && (
              <div>
                <dt>{t.source}</dt>
                <dd>
                  <a href={culture.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" dir="ltr">
                    {culture.sourceUrl}
                    <span className="st-visually-hidden"> {t.newTab}</span>
                  </a>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </Dialog>
      </div>
    </>
  );
}
