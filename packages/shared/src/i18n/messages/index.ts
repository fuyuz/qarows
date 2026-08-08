import { jaMessages } from "./messages/ja";
import { enMessages } from "./messages/en";
import type { Locale } from "../types";

export const messageCatalogs: Record<Locale, Record<string, unknown>> = {
  ja: jaMessages,
  en: enMessages,
};

export { jaMessages, enMessages };
