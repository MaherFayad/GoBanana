/**
 * /en/account opened from a site page (a client navigation, Next intercepting routes): the
 * System Settings window opens over that page, which stays behind it, blurred. Close, Escape and
 * Back return to that page. A direct load or a refresh renders (pages)/(home)/account/page.tsx
 * instead: the same window over the home page.
 */
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { href, isLocale } from "@/lib/site/i18n";
import { AccountWindow } from "../../(pages)/(home)/account/AccountWindow";
import { accountLights } from "../../(pages)/(home)/account/lights";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AccountOverlay({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  return (
    <WindowLayer mode="overlay" kind="settings" label={dict.account.windowTitle} closeHref={href(locale)} escapeCloses>
      <AccountWindow locale={locale} lights={accountLights(locale)} />
    </WindowLayer>
  );
}
