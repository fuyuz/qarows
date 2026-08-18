import { expect, test } from "./fixtures";
import { loadSampleAndStartRun, selectScenario, skipIntroCard, switchToScenarioMode } from "./helpers";

test.describe("scenario mode", () => {
  test("switches to scenario mode and loads first step", async ({ page }) => {
    await loadSampleAndStartRun(page);
    await skipIntroCard(page);

    await switchToScenarioMode(page);
    await expect(page).toHaveURL(/mode=scenario/);

    await selectScenario(page, "初回セットアップ");
    await expect(page).toHaveURL(/scenario=first-time-setup/);

    const tc001 = page.getByRole("button", { name: /TC-001/ });
    await expect(tc001).toBeVisible();
    await tc001.click();
    await expect(page.getByRole("article").filter({ hasText: "TC-001" })).toBeVisible();
  });
});
