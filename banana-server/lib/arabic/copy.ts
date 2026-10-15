/**
 * Sample Arabic copy for a page (VAL-08): a small reviewed phrase bank per page kind. Deterministic,
 * no model call. Arabic is white Saudi dialect with no tashkeel, gender neutral where it can be
 * (nouns, "we" and impersonal forms instead of commands), no em dashes. English says what it means.
 *
 * Add a kind by adding an entry to KINDS (matcher words go in `words`) and a row in tests; the
 * tests check every string for tashkeel, em dashes and Latin letters.
 */
import { cyrb53 } from "@/lib/bend/prng";
import type { BiText } from "@/lib/direction-detail";

export interface CopyKind {
  id: string;
  /** Words (prefix match on a lowercase token) that put a page in this kind. */
  words: readonly string[];
  /** Two headline options; the direction picks one by its id. */
  headline: readonly [BiText, BiText];
  action: BiText;
  support: BiText;
  /** UI elements that usually make up this kind of page (RTL notes cover these parts). */
  parts: readonly string[];
}

const t = (ar: string, en: string): BiText => ({ ar, en });

/** Order matters: the first kind with a matching word wins. */
export const KINDS: readonly CopyKind[] = [
  {
    id: "problem",
    words: ["empty", "error", "offline", "not-found", "notfound", "404", "maintenance", "no-results", "failed"],
    headline: [t("ما لقينا شي هنا", "We found nothing here"), t("صار عندنا خلل بسيط", "We hit a small problem")],
    action: t("إعادة المحاولة", "Try again"),
    support: t("ممكن الإنترنت ضعيف الحين، وإعادة المحاولة بعد شوي تحل الموضوع غالبا.", "The connection may be weak right now, and trying again in a moment usually fixes it."),
    parts: ["header", "empty-state", "cta", "toast"],
  },
  {
    id: "success",
    words: ["success", "confirm", "milestone", "streak", "celebrat", "thank", "congrat", "complete", "done"],
    headline: [t("تم بنجاح", "Done"), t("وصلنا طلبك", "We got your request")],
    action: t("العودة للرئيسية", "Back to home"),
    support: t("أرسلنا لك التفاصيل وهي بانتظارك في الرسائل.", "We sent the details and they are waiting in your messages."),
    parts: ["header", "success", "card", "cta"],
  },
  {
    id: "onboarding",
    words: ["onboard", "sign", "login", "log-in", "otp", "first-run", "welcome", "tour", "identity", "permission", "waitlist", "splash", "register", "forgot"],
    headline: [t("أهلين فيك", "Welcome"), t("حسابك جاهز في دقيقة", "Your account is ready in a minute")],
    action: t("يلا نبدأ", "Let's start"),
    support: t("خطوات قليلة وكل شي يصير جاهز، وتخطيها متاح في أي وقت.", "A few steps and everything is ready, and skipping them is always possible."),
    parts: ["onboarding-slide", "form-field", "progress", "cta"],
  },
  {
    id: "pricing",
    words: ["pricing", "paywall", "plan", "upgrade", "subscri", "billing", "premium", "membership"],
    headline: [t("الباقة اللي تناسبك", "The plan that fits"), t("سعر واضح وبدون مفاجآت", "A clear price with no surprises")],
    action: t("بدء التجربة المجانية", "Start the free trial"),
    support: t("تغيير الباقة أو الإلغاء متاح في أي وقت، وبدون التزام.", "Changing plan or cancelling is possible any time, with no commitment."),
    parts: ["header", "paywall-plan", "toggle", "price-breakdown", "cta"],
  },
  {
    id: "checkout",
    words: ["checkout", "payment", "pay", "cart", "order", "invoice", "transfer", "send-money", "wallet", "bill", "basket", "purchase"],
    headline: [t("طلبك جاهز للدفع", "Your order is ready to pay"), t("آخر خطوة وطلبك عندك", "One last step and your order is yours")],
    action: t("إتمام الدفع", "Complete payment"),
    support: t("المبلغ الإجمالي واضح قبل الدفع، وما فيه رسوم مخفية.", "The total is clear before paying, and there are no hidden fees."),
    parts: ["header", "stepper", "form-field", "price-breakdown", "total", "cta"],
  },
  {
    id: "booking",
    words: ["booking", "book", "flight", "hotel", "trip", "seat", "ticket", "itinerary", "boarding", "reserv", "appointment", "event", "calendar", "ride", "stay", "travel"],
    headline: [t("حجزك يبدأ من هنا", "Your booking starts here"), t("وين وجهتك الجاية؟", "Where to next?")],
    action: t("تأكيد الحجز", "Confirm booking"),
    support: t("التعديل والإلغاء بدون رسوم لين قبل الموعد بيوم، والتفاصيل توصلك على جوالك خلال دقايق.", "Changes and cancellation are free until the day before, and the details reach your phone within minutes."),
    parts: ["header", "search", "card", "list-row", "price-breakdown", "cta"],
  },
  {
    id: "search",
    words: ["search", "filter", "result", "browse", "catalog", "listing", "explore", "discover"],
    headline: [t("وش المطلوب اليوم؟", "What are we looking for today?"), t("نتائج تناسب بحثك", "Results that fit your search")],
    action: t("بحث", "Search"),
    support: t("الترتيب حسب السعر أو التقييم أو الأقرب، والفلاتر تضيق النتائج بسرعة.", "Sort by price, rating or distance, and filters narrow the results fast."),
    parts: ["search", "chip-filter", "list-row", "card", "sheet"],
  },
  {
    id: "dashboard",
    words: ["dashboard", "analytic", "chart", "portfolio-value", "budget", "transaction", "invest", "stock", "crypto", "activity", "summary", "report", "stats"],
    headline: [t("ملخص اليوم بنظرة وحدة", "Today at a glance"), t("وضعك المالي بوضوح", "Your finances, clearly")],
    action: t("عرض التفاصيل", "View details"),
    support: t("الأرقام تتجدد أول بأول، وتغيير الفترة من الأعلى.", "The numbers update live, and the period is changed from the top."),
    parts: ["header", "chart", "card", "list-row", "chip-filter"],
  },
  {
    id: "media",
    words: ["player", "music", "video", "podcast", "stream", "story", "playlist", "reading", "article", "news", "blog", "watch", "episode"],
    headline: [t("محتواك المفضل في مكان واحد", "Your favorite content in one place"), t("نكمل من وين وقفنا", "We continue where we stopped")],
    action: t("تشغيل", "Play"),
    support: t("التحميل للمشاهدة بدون إنترنت متاح، والتشغيل يكمل من آخر نقطة.", "Download for offline viewing is available, and playback resumes from the last point."),
    parts: ["header", "card", "progress", "list-row", "bottom-nav"],
  },
  {
    id: "learning",
    words: ["course", "lesson", "quiz", "workout", "habit", "meditat", "health", "doctor", "learn", "study", "fitness", "coach"],
    headline: [t("خطوة اليوم جاهزة", "Today's step is ready"), t("تقدمنا يزيد كل يوم", "We progress a little every day")],
    action: t("بدء الجلسة", "Start the session"),
    support: t("عشر دقايق كل يوم تكفي، والتذكير يجي في الوقت المحدد.", "Ten minutes a day is enough, and the reminder comes at the set time."),
    parts: ["header", "progress", "card", "list-row", "cta"],
  },
  {
    id: "settings",
    words: ["settings", "profile", "account", "notification", "privacy", "preferences", "edit-profile", "integration", "api-key"],
    headline: [t("إعدادات حسابك", "Your account settings"), t("الإعدادات على كيفك", "Settings your way")],
    action: t("حفظ التغييرات", "Save changes"),
    support: t("التغييرات تنحفظ مباشرة، والرجوع للإعدادات الأصلية بضغطة وحدة.", "Changes save right away, and going back to the defaults is one tap."),
    parts: ["header", "list-row", "toggle", "form-field", "avatar"],
  },
  {
    id: "home",
    words: ["home", "landing", "launch", "campaign", "hero", "feature", "manifesto", "career", "download", "product-tour", "newsletter", "site", "portfolio", "docs"],
    headline: [t("كل اللي يلزم في مكان واحد", "Everything needed in one place"), t("أسهل طريقة للبدء", "The easiest way to start")],
    action: t("نبدأ الحين", "Start now"),
    support: t("تصميم بسيط وسريع، وكل خطوة واضحة من أول لحظة.", "A simple, fast design where every step is clear from the first moment."),
    parts: ["header", "hero", "card", "section-nav", "cta"],
  },
];

/** Used when no page word matches. */
export const GENERIC: CopyKind = {
  id: "generic",
  words: [],
  headline: [t("كل شي يبدأ من هنا", "Everything starts here"), t("أهلا بك", "Welcome")],
  action: t("متابعة", "Continue"),
  support: t("خطوات بسيطة وواضحة، وكل شي في مكانه.", "Simple, clear steps with everything in its place."),
  parts: ["header", "hero", "card", "list-row", "cta"],
};

const tokens = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function match(text: string): CopyKind | undefined {
  const toks = tokens(text);
  if (toks.length === 0) return undefined;
  const joined = toks.join("-");
  return KINDS.find((k) => k.words.some((w) => (w.includes("-") ? joined.includes(w) : toks.some((tok) => tok.startsWith(w)))));
}

/**
 * The copy kind of a page. The page id wins, then the saved page names, then the brief; a page the
 * words do not name gets the generic copy.
 */
export function copyKindOf(sources: { pageId?: string | null; pages?: readonly string[] | null; brief?: string | null }): CopyKind {
  for (const text of [sources.pageId ?? "", (sources.pages ?? []).join(" "), sources.brief ?? ""]) {
    const hit = text ? match(text) : undefined;
    if (hit) return hit;
  }
  return GENERIC;
}

/** The headline, action and supporting line for a kind; `seed` (the direction id) picks the headline. */
export function sampleCopy(kind: CopyKind, seed: string): { headline: BiText; action: BiText; support: BiText } {
  return { headline: kind.headline[cyrb53(`${seed}|${kind.id}`) % 2]!, action: kind.action, support: kind.support };
}
