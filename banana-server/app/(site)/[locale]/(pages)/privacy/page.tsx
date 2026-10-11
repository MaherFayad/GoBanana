/** Privacy notice (DRAFT, PDPL-aware, needs legal review). */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { privacyAr } from "@/lib/site/legal/privacy.ar";
import { privacyEn } from "@/lib/site/legal/privacy.en";
import { LegalDocument } from "../../../_components/LegalDocument";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: (locale === "ar" ? privacyAr : privacyEn).title } : {};
}

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="wrap page">
      <LegalDocument doc={locale === "ar" ? privacyAr : privacyEn} t={getDict(locale).legal} locale={locale} />
    </div>
  );
}
