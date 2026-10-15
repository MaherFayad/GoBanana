/**
 * Words for the client review panel on the share page (VAL-04), English and Arabic (white Saudi
 * dialect, no tashkeel). The share page has no locale in its address, so it picks one from the
 * `?lang=` link or the browser's language and sets `lang` and `dir` on the panel itself.
 */
export type ReviewLocale = "en" | "ar";

export type ReviewCopy = {
  toggle: string;
  panelLabel: string;
  heading: string;
  intro: string;
  nameLabel: string;
  keep: string;
  drop: string;
  kept: string;
  dropped: string;
  verdictGroup: string;
  commentLabel: string;
  commentHint: string;
  save: string;
  saved: string;
  cleared: string;
  failed: string;
  rateLimited: string;
  full: string;
  empty: string;
  close: string;
  langSwitch: string;
  langSwitchLabel: string;
};

const en: ReviewCopy = {
  toggle: "Review",
  panelLabel: "Review this canvas",
  heading: "Your review",
  intro: "Keep or drop each direction and leave a short comment. No sign in needed. The owner of the canvas sees your answers.",
  nameLabel: "Your name (optional)",
  keep: "Keep",
  drop: "Drop",
  kept: "Kept",
  dropped: "Dropped",
  verdictGroup: "Your verdict on {title}",
  commentLabel: "Comment on {title}",
  commentHint: "{n} of {max} characters. Plain text only.",
  save: "Save comment",
  saved: "Saved.",
  cleared: "Cleared.",
  failed: "Could not save. Try again in a minute.",
  rateLimited: "Too many changes too fast. Wait a minute and try again.",
  full: "This canvas has reached its review limit.",
  empty: "This canvas has no directions to review.",
  close: "Close review",
  langSwitch: "العربية",
  langSwitchLabel: "Read this panel in Arabic",
};

const ar: ReviewCopy = {
  toggle: "مراجعة",
  panelLabel: "مراجعة هذي اللوحة",
  heading: "رأيك",
  intro: "اختر إبقاء أو استبعاد لكل اتجاه، واكتب تعليق قصير. ما تحتاج تسجل دخول. صاحب اللوحة يشوف إجاباتك.",
  nameLabel: "اسمك (اختياري)",
  keep: "إبقاء",
  drop: "استبعاد",
  kept: "تم الإبقاء",
  dropped: "تم الاستبعاد",
  verdictGroup: "رأيك في {title}",
  commentLabel: "تعليق على {title}",
  commentHint: "{n} من {max} حرف. نص عادي فقط.",
  save: "حفظ التعليق",
  saved: "تم الحفظ.",
  cleared: "تم المسح.",
  failed: "تعذر الحفظ. حاول مرة ثانية بعد دقيقة.",
  rateLimited: "تغييرات كثيرة بسرعة. انتظر دقيقة وحاول مرة ثانية.",
  full: "وصلت هذي اللوحة للحد الأعلى من المراجعات.",
  empty: "ما في اتجاهات للمراجعة في هذي اللوحة.",
  close: "إغلاق المراجعة",
  langSwitch: "English",
  langSwitchLabel: "اقرأ هذه اللوحة بالإنجليزية",
};

export function reviewCopy(locale: ReviewLocale): ReviewCopy {
  return locale === "ar" ? ar : en;
}

/** `?lang=ar` wins; else the browser's first language. Anything else is English. */
export function reviewLocale(lang: string | undefined, acceptLanguage: string | null | undefined): ReviewLocale {
  if (lang === "ar" || lang === "en") return lang;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("ar") ? "ar" : "en";
}
