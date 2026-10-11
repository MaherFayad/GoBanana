/**
 * Legal documents as data so the page renders headings, lists and a table of
 * contents the same way in both languages. `{app}` and `{contact}` are filled
 * at render time (APP_NAME and LEGAL_CONTACT_EMAIL).
 */
export type LegalSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  list?: string[];
  /** Optional table, for example the processor list in the privacy notice. */
  table?: { caption: string; head: string[]; rows: string[][] };
};

export type LegalDoc = {
  title: string;
  /** ISO date. */
  updated: string;
  intro: string[];
  sections: LegalSection[];
};

/** TODO(owner): set LEGAL_CONTACT_EMAIL before launch. */
export function legalContact(): string {
  return process.env.LEGAL_CONTACT_EMAIL?.trim() || "privacy@example.com";
}
