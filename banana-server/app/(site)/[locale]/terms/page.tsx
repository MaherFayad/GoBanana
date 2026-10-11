/** Terms of service (DRAFT, needs legal review). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { termsAr } from "@/lib/site/legal/terms.ar";
import { termsEn } from "@/lib/site/legal/terms.en";
import { LegalDocument } from "../../_components/LegalDocument";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: (locale === "ar" ? termsAr : termsEn).title } : {};
}

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <LegalDocument doc={locale === "ar" ? termsAr : termsEn} t={getDict(locale).legal} locale={locale} />;
}
