import { test as base } from "@playwright/test";

const DB_NAME = "qarows-v1";

/** IndexedDB を消してから /load へ。コンテキストごとに分離されるが、同一テスト内の再実行用。 */
export async function resetAppStorage(page: import("@playwright/test").Page) {
  await page.goto("/load");
  await page.evaluate(async (dbName) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("deleteDatabase failed"));
      request.onblocked = () => resolve();
    });
  }, DB_NAME);
  await page.reload();
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await resetAppStorage(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
