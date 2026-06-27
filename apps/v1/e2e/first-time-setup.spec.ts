import { expect, test } from "./fixtures";

/**
 * tests.yml scenarios.first-time-setup の主要ステップ:
 * サンプル読み込み → セッション開始 → 使い方カード → 1件目入力 → 自動で次へ
 */
test.describe("first-time setup", () => {
  test("loads sample, starts session, and records first test result", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "qarows" })).toBeVisible();

    await page.getByRole("button", { name: "サンプルを試す" }).click();
    await expect(page.getByText("tests.yml", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "テストを開始" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/session$/);
    await expect(page.getByRole("heading", { name: "セッション設定" })).toBeVisible();

    await page.getByLabel("実施者名").fill("e2e-tester");
    await page.getByRole("button", { name: "すべて選択" }).click();
    await page.getByRole("button", { name: "テスト実行を開始" }).click();

    await expect(page).toHaveURL(/\/p\/qarows\/run/);
    const startButton = page.getByRole("button", { name: "はじめる" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    const testCard = page.getByRole("article").filter({ hasText: "TC-001" });
    await expect(testCard).toBeVisible();
    await testCard.getByRole("button", { name: "一括 OK" }).click();

    // 500ms 待ち + カード遷移後に次のテストへ
    await expect(page.getByRole("article").filter({ hasText: "TC-002" })).toBeVisible({
      timeout: 5_000,
    });
  });
});
