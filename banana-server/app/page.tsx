import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { href } from "@/lib/site/i18n";

// "/" sends Arabic-first browsers to /ar and everyone else to /en.
export default async function Home() {
  const accept = (await headers()).get("accept-language") ?? "";
  redirect(href(/^\s*ar\b/i.test(accept) ? "ar" : "en"));
}
