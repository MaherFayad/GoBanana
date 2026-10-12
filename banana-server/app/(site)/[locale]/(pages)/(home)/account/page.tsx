/**
 * /en/account and /ar/account loaded directly (or refreshed): the System Settings window
 * (AccountWindow.tsx) over the home page, which renders behind it, blurred and inert (the landing
 * is this route's layout). Close, Escape and minimize go to the home page. Opened from a site
 * page, the same URL is intercepted (@modal/(.)account) and the window opens over that page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { href, isLocale } from "@/lib/site/i18n";
import { AccountWindow } from "./AccountWindow";
import { accountLights } from "./lights";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { title: getDict(locale).account.title, robots: { index: false } } : {};
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  return (
    <WindowLayer mode="home" kind="settings" label={dict.account.windowTitle} closeHref={href(locale)} escapeCloses>
      <AccountWindow locale={locale} lights={accountLights(locale)} />
    </WindowLayer>
  );
}
