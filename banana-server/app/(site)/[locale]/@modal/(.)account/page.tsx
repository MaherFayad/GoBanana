/**
 * /en/account opened from a site page (a client navigation, Next intercepting routes): the
 * System Settings window opens over that page, which stays behind it, blurred. Close, Escape and
 * Back return to that page. A direct load or a refresh renders (pages)/account/page.tsx instead.
 */
import { notFound } from "next/navigation";
import { WindowLayer } from "@/components/window/WindowLayer";
import { getDict } from "@/lib/site/dict";
import { href, isLocale } from "@/lib/site/i18n";
import { FrameLights } from "../../../_components/desktop/FrameLights";
import { AccountWindow } from "../../(pages)/account/AccountWindow";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export default async function AccountOverlay({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const w = dict.landing.desk.window;
  return (
    <WindowLayer
      mode="overlay"
      kind="settings"
      label={dict.account.windowTitle}
      closeHref={href(locale)}
      escapeCloses
    >
      <AccountWindow locale={locale} lights={<FrameLights title={dict.account.windowTitle} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />} />
    </WindowLayer>
  );
}
