import "server-only";
import { type I18n, setupI18n } from "@lingui/core";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { cookies, headers } from "next/headers";
import { cache } from "react";

import {
  getMessages,
  isLocale,
  LOCALE_COOKIE,
  type Locale,
  negotiateLocale,
} from "@domainstack/i18n";

/**
 * Resolve the request locale from the `ds_locale` cookie (set by middleware),
 * falling back to `Accept-Language`. `cache()` dedupes the cookie/header read
 * across `generateMetadata` + the layout within a single request.
 */
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale((await headers()).get("accept-language"));
});

/**
 * A REQUEST-SCOPED i18n instance — never the shared singleton. Using the
 * singleton on the server would leak one visitor's locale into another's
 * response under concurrency.
 *
 * `setMessagesCompiler(compileMessage)` neutralizes the Lingui +
 * `reactCompiler: true` interference (the macro output can be rewritten before
 * it's recognized as compiled) by letting the runtime compile ICU on demand.
 */
export const getI18n = cache(async (): Promise<I18n> => {
  const locale = await getRequestLocale();
  const messages = await getMessages(locale);
  const i18n = setupI18n({ locale, messages: { [locale]: messages } });
  i18n.setMessagesCompiler(compileMessage);
  return i18n;
});
