import { expect, test } from "./fixtures";
import { loadSampleAndStartRun, skipIntroCard } from "./helpers";

/**
 * tests.yml scenarios.first-time-setup の主要ステップ:
 * サンプル読み込み → セッション開始 → 使い方カード → 1件目入力 → 自動で次へ
 */
test.describe("first-time setup", () => {
  test("loads sample, starts session, and records first test result", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "qarows" })).toBeVisible();

    await loadSampleAndStartRun(page);
    await skipIntroCard(page);

    const testCard = page.getByRole("article").filter({ hasText: "TC-001" });
    await expect(testCard).toBeVisible();
    await testCard.getByRole("button", { name: "一括 OK" }).click();

    await expect(page.getByRole("article").filter({ hasText: "TC-002" })).toBeVisible({
      timeout: 5_000,
    });
  });
});
