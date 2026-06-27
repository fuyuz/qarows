/** ISO 8601 として解釈可能な日時文字列か検証する */
export function parseIsoTimestamp(value: unknown, fieldLabel: string): string {
  if (value == null) {
    throw new Error(`${fieldLabel} は必須です`);
  }
  const str = String(value).trim();
  if (!str) {
    throw new Error(`${fieldLabel} は空にできません`);
  }
  if (Number.isNaN(Date.parse(str))) {
    throw new Error(`${fieldLabel} は ISO 8601 形式である必要があります`);
  }
  return str;
}

export function parseOptionalIsoTimestamp(
  value: unknown,
  fieldLabel: string,
): string | undefined {
  if (value == null) return undefined;
  return parseIsoTimestamp(value, fieldLabel);
}
