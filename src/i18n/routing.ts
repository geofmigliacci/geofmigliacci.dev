import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/i18n/locales";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  // Both prefixed, so `/` negotiates rather than silently serving English.
  localePrefix: "always",
  // The pages render hreflang themselves; the header disagreed with them on fallbacks and x-default.
  alternateLinks: false,
});
