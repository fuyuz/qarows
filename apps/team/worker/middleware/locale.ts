import { createTranslator, parseAcceptLanguage, type Locale, type TranslateFn } from "@qarows/shared";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../types";

export const localeMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const locale: Locale = parseAcceptLanguage(c.req.header("Accept-Language"));
  const t: TranslateFn = createTranslator(locale);
  c.set("locale", locale);
  c.set("t", t);
  await next();
};
