"use client";

import { setupI18n } from "@lingui/core";
import { compileMessage } from "@lingui/message-utils/compileMessage";
import { I18nProvider } from "@lingui/react";
import { useEffect, useMemo } from "react";

import type { Locale, Messages } from "@domainstack/i18n";

/**
 * Client-side Lingui context. A fresh request-scoped instance is created per
 * `locale`/`messages` change — when the visitor switches language, the server
 * re-renders (via `router.refresh()`) and passes new props, so this re-creates
 * cleanly without touching a shared singleton.
 *
 * `setMessagesCompiler(compileMessage)` is the runtime mitigation for the
 * Lingui + `reactCompiler: true` interference (see lib/i18n-server.ts).
 *
 * The static prerendered shell renders `<html lang>` with the default locale
 * (the real locale is a per-request cookie, dynamic under Cache Components — see
 * app/layout.tsx). Sync the resolved locale onto `<html lang>` after hydration
 * so assistive tech and crawlers see the correct language.
 */
export function I18nClientProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  const i18n = useMemo(() => {
    const instance = setupI18n({ locale, messages: { [locale]: messages } });
    instance.setMessagesCompiler(compileMessage);
    return instance;
  }, [locale, messages]);

  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return <I18nProvider i18n={i18n}>{children}</I18nProvider>;
}
