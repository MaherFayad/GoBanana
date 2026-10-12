/**
 * /en/account and /ar/account: the System Settings window (AccountWindow.tsx) on the desk. Opened
 * from a site page, the same URL is intercepted (@modal/(.)account) and the window opens over that
 * page instead.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDict } from "@/lib/site/dict";
import { isLocale } from "@/lib/site/i18n";
import { AccountWindow } from "./AccountWindow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).account.title, robots: { index: false } } : {};
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div className="wrap page settings-page">
      <AccountWindow locale={locale} />
    </div>
  );
}
