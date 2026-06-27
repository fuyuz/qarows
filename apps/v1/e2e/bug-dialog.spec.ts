import { expect, test } from "./fixtures";
import { loadSampleAndStartRun, skipIntroCard } from "./helpers";

test.describe("bug dialog", () => {
  test("opens on batch NG and advances after cancel", async ({ page }) => {
    await loadSampleAndStartRun(page);
    await skipIntroCard(page);

    const testCard = page.getByRole("article").filter({ hasText: "TC-001" });
    await expect(testCard).toBeVisible();
    await testCard.getByRole("button", { name: "一括 NG" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "バグを起票" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await expect(page.getByRole("article").filter({ hasText: "TC-002" })).toBeVisible({
      timeout: 5_000,
    });
  });
});
