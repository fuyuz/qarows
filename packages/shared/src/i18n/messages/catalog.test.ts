import { describe, expect, it } from "vitest";
import { LOCALE_DEFINITIONS } from "../locales";
import { enMessages } from "./en";

function flattenMessageKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      keys.push(...flattenMessageKeys(value as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys;
}

function flattenMessageStrings(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(entries, flattenMessageStrings(value as Record<string, unknown>, path));
    } else if (typeof value === "string") {
      entries[path] = value;
    }
  }
  return entries;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]!);
}

describe("message catalogs", () => {
  const enKeys = flattenMessageKeys(enMessages).sort();

  it("every registered locale has the same keys as en", () => {
    for (const def of LOCALE_DEFINITIONS) {
      const keys = flattenMessageKeys(def.messages).sort();
      expect(keys, def.id).toEqual(enKeys);
    }
  });

  it("every registered locale uses the same placeholders as en", () => {
    const enStrings = flattenMessageStrings(enMessages);
    for (const def of LOCALE_DEFINITIONS) {
      const localeStrings = flattenMessageStrings(def.messages);
      for (const [key, enValue] of Object.entries(enStrings)) {
        expect(placeholders(localeStrings[key] ?? ""), `${def.id}:${key}`).toEqual(
          placeholders(enValue),
        );
      }
    }
  });
});
