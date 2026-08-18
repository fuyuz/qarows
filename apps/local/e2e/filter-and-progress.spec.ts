import { expect, test } from "./fixtures";
import {
  loadSampleAndStartRun,
  selectMajorCategory,
  selectMediumCategory,
  skipIntroCard,
} from "./helpers";

/**
 * tests.yml scenarios.filter-and-progress の主要ステップ:
 * 大分類 → 中分類 → 小分類 → 進捗バー表示
 */
test.describe("filter and progress", () => {
  test("category filters update URL and narrow visible tests", async ({ page }) => {
    await loadSampleAndStartRun(page);
    await skipIntroCard(page);

    await expect(page.getByRole("article").filter({ hasText: "TC-001" })).toBeVisible();

    await selectMajorCategory(page, "テスト実行");
    await expect(page).toHaveURL(/major=%E3%83%86%E3%82%B9%E3%83%88%E5%AE%9F%E8%A1%8C/);
    await expect(page.getByRole("article").filter({ hasText: "TC-001" })).not.toBeVisible({
      timeout: 3_000,
    });

    await selectMediumCategory(page, "画面");
    await expect(page).toHaveURL(/medium=%E7%94%BB%E9%9D%A2/);

    const tc009 = page.getByRole("button", { name: /TC-009/ });
    await expect(tc009).toBeVisible();
    await tc009.click();
    await expect(page.getByRole("article").filter({ hasText: "TC-009" })).toBeVisible();
    await expect(page.getByRole("button", { name: /TC-001/ })).not.toBeVisible();
  });

  test("shows dual progress bars on runner screen", async ({ page }) => {
    await loadSampleAndStartRun(page);
    await skipIntroCard(page);

    await expect(page.getByText("残り", { exact: false }).first()).toBeVisible();
    await expect(page.locator('[role="progressbar"]')).toHaveCount(2);
  });
});
