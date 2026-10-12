/** The settings window's working traffic lights, for both ways it opens (page.tsx, @modal/(.)account). */
import { getDict } from "@/lib/site/dict";
import type { Locale } from "@/lib/site/i18n";
import { FrameLights } from "../../../../_components/desktop/FrameLights";

export function accountLights(locale: Locale) {
  const dict = getDict(locale);
  const w = dict.landing.desk.window;
  return <FrameLights title={dict.account.windowTitle} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />;
}
