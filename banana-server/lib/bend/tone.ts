/**
 * Tone matching: subjects map to tones that suit them, so a meditation app never gets an "acid
 * bright" mood or a gig poster at low wildness. Rule based on the brief's words.
 */
import type { ListEntry, Tone, Wildness } from "./types";

export interface Domain {
  id: string;
  /** Brief words (lowercase, whole words) that name the domain. */
  words: readonly string[];
  /** Tones that suit it: a mood needs at least one. */
  allow: readonly Tone[];
  /** Tones that clash with it: never picked below wildness 4. */
  clash: readonly Tone[];
  /** Who uses it, for the whyItFits line. */
  audience: string;
}

/**
 * Checked in order: the first domain with a matching word wins. Travel sits before luxury so a
 * trip that books a hotel stays travel; ai-agents comes last so a vertical (an AI bank) keeps its own.
 */
export const DOMAINS: readonly Domain[] = [
  {
    id: "calm-care",
    words: ["meditation", "meditate", "mindfulness", "mindful", "sleep", "yoga", "wellness", "wellbeing", "therapy", "mental", "journal", "journaling", "spa", "breathing", "breathwork", "relax", "relaxation", "calm", "تأمل", "نوم"],
    allow: ["calm", "light", "warm", "luxe", "dark"],
    clash: ["energetic", "cold"],
    audience: "people winding down",
  },
  {
    id: "health",
    words: ["health", "medical", "hospital", "clinic", "doctor", "patient", "patients", "pharmacy", "dental", "telehealth", "healthcare", "nurse", "care", "صحة", "مستشفى"],
    allow: ["calm", "light", "serious", "warm"],
    clash: ["energetic", "dark"],
    audience: "patients and carers who need clarity",
  },
  {
    id: "kids",
    words: ["kids", "kid", "children", "child", "toddler", "toddlers", "kindergarten", "preschool", "school", "homework", "toy", "toys", "أطفال"],
    allow: ["playful", "energetic", "light", "warm"],
    clash: ["dark", "serious"],
    audience: "kids and the parents watching over them",
  },
  {
    id: "money",
    words: ["bank", "banking", "finance", "financial", "fintech", "budget", "budgeting", "invest", "investing", "investment", "wallet", "tax", "taxes", "insurance", "accounting", "payroll", "loan", "loans", "mortgage", "savings", "money", "pension", "بنك", "مالية"],
    allow: ["serious", "calm", "luxe", "cold", "light", "dark", "warm"],
    clash: ["playful", "energetic"],
    audience: "people checking on their money",
  },
  {
    id: "work",
    words: ["b2b", "saas", "analytics", "crm", "erp", "admin", "enterprise", "logistics", "fleet", "legal", "compliance", "hr", "procurement", "inventory", "devops", "security", "observability", "government", "e-services"],
    allow: ["serious", "cold", "calm", "light", "dark"],
    clash: ["playful"],
    audience: "teams who read numbers all day",
  },
  {
    id: "travel",
    words: ["travel", "flight", "flights", "airline", "airport", "trip", "trips", "itinerary", "boarding", "visa", "umrah", "سفر", "رحلة"],
    allow: ["calm", "light", "warm", "energetic", "serious", "luxe"],
    clash: [],
    audience: "travellers planning, paying and on the move",
  },
  {
    id: "luxury",
    words: ["luxury", "fashion", "jewelry", "jewellery", "perfume", "fragrance", "wine", "hotel", "resort", "boutique", "couture", "beauty", "skincare", "watches", "فاخر"],
    allow: ["luxe", "calm", "dark", "serious", "light", "warm"],
    clash: ["playful", "energetic"],
    audience: "buyers who expect polish",
  },
  {
    id: "food",
    words: ["food", "restaurant", "recipe", "recipes", "snack", "snacks", "candy", "coffee", "bakery", "cafe", "grocery", "groceries", "pizza", "burger", "drinks", "bar", "brewery", "cooking", "meal", "meals", "مطعم", "قهوة"],
    allow: ["warm", "playful", "energetic", "light", "calm"],
    clash: ["cold"],
    audience: "hungry people deciding fast",
  },
  {
    id: "fun",
    words: ["game", "games", "gaming", "esports", "party", "festival", "concert", "music", "nightlife", "club", "dating", "social", "meme", "memes", "streaming", "karaoke", "ألعاب"],
    allow: ["energetic", "playful", "dark", "warm"],
    clash: ["serious"],
    audience: "fans who came for a good time",
  },
  {
    id: "sport",
    words: ["fitness", "workout", "gym", "running", "sport", "sports", "training", "cycling", "marathon", "football", "soccer"],
    allow: ["energetic", "dark", "serious", "playful", "cold"],
    clash: [],
    audience: "people chasing a personal best",
  },
  {
    id: "ai-agents",
    words: ["agent", "agents", "agentic", "autonomous", "copilot", "assistant", "chatbot", "llm", "ai", "automation", "orchestration", "وكيل"],
    allow: ["serious", "calm", "cold", "warm", "playful", "light", "dark"],
    clash: [],
    audience: "people who hand work to software and still answer for it",
  },
];

/** The domain the brief names, or null. */
export function detectDomain(brief: string): Domain | null {
  const words = new Set(brief.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []);
  // "AI-powered" also counts as "ai" and "powered"; the whole token stays for "e-services".
  for (const w of [...words]) if (w.includes("-")) for (const part of w.split("-")) if (part) words.add(part);
  return DOMAINS.find((d) => d.words.some((w) => words.has(w))) ?? null;
}

/** True when an entry's tones never clash with the domain (entries with no tone always fit). */
export function noClash(entry: ListEntry, domain: Domain | null): boolean {
  if (!domain) return true;
  return !entry.hints.tone.some((t) => domain.clash.includes(t));
}

/** True when a mood suits the domain: its first tone is allowed and none clash. Any mood fits with no domain. */
export function moodFits(mood: ListEntry, domain: Domain | null): boolean {
  if (!domain) return true;
  const first = mood.hints.tone[0];
  return noClash(mood, domain) && (first === undefined || domain.allow.includes(first));
}

/** True when a mood clashes with the domain on purpose (the wild clash at wildness 4 and 5). */
export function moodClashes(mood: ListEntry, domain: Domain | null): boolean {
  return Boolean(domain) && !noClash(mood, domain);
}

/** Highest weirdness allowed at each wildness: nothing absurd at 1 to 3. */
export const MAX_WEIRD: Record<Wildness, 1 | 2 | 3> = { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 };

/** Clashing tones are avoided below this wildness. */
export const CLASH_FROM_WILDNESS = 4;
