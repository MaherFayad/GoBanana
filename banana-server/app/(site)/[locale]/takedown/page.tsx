/** Takedown request page (spec section 3, hard rule 5). Posts to /api/takedown. */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { fmt, isLocale } from "@/lib/site/i18n";
import { TakedownForm } from "./TakedownForm";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).takedown.title } : {};
}

const STATUSES = ["sent", "failed", "invalid"] as const;

export default async function TakedownPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getDict(locale).takedown;
  const raw = (await searchParams).status;
  const status = STATUSES.find((s) => s === raw) ?? "idle";

  return (
    <>
      <h1>{t.title}</h1>
      <p className="lead">{fmt(t.lead)}</p>

      <section className="section" aria-labelledby="process-title">
        <h2 id="process-title">{t.processTitle}</h2>
        <ol>
          {t.process.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="form-title">
        <h2 id="form-title">{t.formTitle}</h2>
        <TakedownForm t={t} locale={locale} initialStatus={status} />
      </section>
    </>
  );
}
