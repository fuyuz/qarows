import type { Env } from "./env";
import type { AuthUser } from "./auth";
import type { Locale, TranslateFn } from "@qarows/shared";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
    requestId: string;
    locale: Locale;
    t: TranslateFn;
  };
};
