import type { Locale } from "../i18n";
import { ar } from "./ar";
import { en, type Dict } from "./en";

export type { Dict };

export function getDict(locale: Locale): Dict {
  return locale === "ar" ? ar : en;
}
