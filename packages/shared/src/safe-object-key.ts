/**
 * `__proto__` は Object.prototype 上のアクセサなので、外部由来の文字列をそのまま
 * オブジェクトキーに代入すると prototype を差し替えてしまう。
 * Object.keys にも現れないため、後段の未定義 ID チェックもすり抜ける。
 * tests.yml / results.json の入口で弾き、以降のキーを信用できるようにする
 */
export const UNSAFE_OBJECT_KEY = "__proto__";

export function isUnsafeObjectKey(key: string): boolean {
  return key === UNSAFE_OBJECT_KEY;
}

/** label は「testCases[0].id」のように、そのまま文に繋がる形で渡す */
export function assertSafeObjectKey(key: string, label: string): void {
  if (isUnsafeObjectKey(key)) {
    throw new Error(`${label} に ${UNSAFE_OBJECT_KEY} は使用できません`);
  }
}
