/** The swipe file window's working traffic lights. */
import { getDict } from "@/lib/site/dict";
import type { Locale } from "@/lib/site/i18n";
import { FrameLights } from "../../../../_components/desktop/FrameLights";

export function libraryLights(locale: Locale) {
  const dict = getDict(locale);
  const w = dict.landing.desk.window;
  return <FrameLights title={dict.library.windowTitle} labels={{ close: w.close, minimise: w.minimise, zoom: w.zoom }} />;
}
