import { expect, test } from "./fixtures";
import { loadSampleAndStartRun, openNavMenu } from "./helpers";

test.describe("viewing pages", () => {
  test("navigates to dashboard, matrix, and bugs from compass menu", async ({ page }) => {
    await loadSampleAndStartRun(page);

    await openNavMenu(page);
    await page.getByRole("menuitem", { name: "ダッシュボード" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/dashboard$/);
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();

    await openNavMenu(page);
    await page.getByRole("menuitem", { name: "マトリクス" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/matrix/);
    await expect(page.getByRole("heading", { name: "マトリクス" })).toBeVisible({
      timeout: 10_000,
    });

    await openNavMenu(page);
    await page.getByRole("menuitem", { name: "バグ" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/bugs$/);
  });

  test("navigates to top from compass menu", async ({ page }) => {
    await loadSampleAndStartRun(page);

    await openNavMenu(page);
    await page.getByRole("menuitem", { name: "トップ" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("link", { name: "作業を続ける" })).toBeVisible();
  });
});
