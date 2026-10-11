/**
 * Takedown request page (spec section 3, hard rule 5). Posts to /api/takedown.
 * "What happens next" is a three-step picture (send, review, blocked everywhere) with the
 * fourth point, about the image itself, as a note under it.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { ClockIcon, InfoIcon, SendIcon, ShieldIcon } from "@/components/studio/icons";
import { isLocale } from "@/lib/site/i18n";
import { bidi, bt } from "../../../_components/Bidi";
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
    <div className="wrap page">
      <h1>{t.title}</h1>
      <p className="lead">{bt(t.lead)}</p>

      <section className="section" aria-labelledby="process-title">
        <h2 id="process-title">{t.processTitle}</h2>
        <ol className="process">
          {t.processSteps.map((title, i) => {
            const Icon = [SendIcon, ClockIcon, ShieldIcon][i] ?? ShieldIcon;
            return (
              <li key={title} className="process-step">
                <span className="process-mark" aria-hidden="true">
                  <Icon size={24} />
                </span>
                <h3 className="process-title">{title}</h3>
                <p>{bidi(t.process[i] ?? "")}</p>
              </li>
            );
          })}
        </ol>
        {t.process.slice(t.processSteps.length).map((note) => (
          <p key={note} className="process-note">
            <InfoIcon size={16} />
            <span>{bidi(note)}</span>
          </p>
        ))}
      </section>

      <section className="section" aria-labelledby="form-title">
        <h2 id="form-title">{t.formTitle}</h2>
        <TakedownForm t={t} locale={locale} initialStatus={status} />
      </section>
    </div>
  );
}
