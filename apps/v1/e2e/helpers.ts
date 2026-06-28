import { expect, type Page } from "@playwright/test";
import { importPanel } from "./multi-project-helpers";

export async function openLanding(page: Page) {
  await page.goto("/");
}

export async function startFromLanding(page: Page) {
  await openLanding(page);
  await page.getByRole("button", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/projects/);
  await expect(importPanel(page).getByRole("button", { name: "サンプルを試す" })).toBeVisible();
}

export async function loadSampleProject(page: Page) {
  await page.goto("/load");
  await expect(page).toHaveURL(/\/projects\?project=_new$/);
  const panel = importPanel(page);
  await panel.getByRole("button", { name: "サンプルを試す" }).click();
  await expect(panel.getByText("tests.yml", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "読み込む", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/qarows\/session$/);
}

export async function startSession(page: Page, executorName = "e2e-tester", projectId = "qarows") {
  await page.getByLabel("実施者名").fill(executorName);
  await page.getByRole("button", { name: "すべて選択" }).click();
  await page.getByRole("button", { name: "テスト実行を開始" }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${projectId}/run`));
}

export async function skipIntroCard(page: Page) {
  const introStart = page.getByRole("article").filter({ hasText: "START" }).getByRole("button", {
    name: "はじめる",
  });
  try {
    await introStart.waitFor({ state: "visible", timeout: 5_000 });
    await introStart.click();
  } catch {
    // セッション復帰などで使い方カードが省略されている場合はそのまま続行
  }
}

export async function loadSampleAndStartRun(page: Page) {
  await loadSampleProject(page);
  await startSession(page);
}

export async function openNavMenu(page: Page) {
  await page.getByRole("button", { name: "ナビゲーション" }).click();
}

export async function selectMajorCategory(page: Page, major: string) {
  const row = page.locator("div.flex.items-center.gap-2").filter({
    has: page.getByText("大分類", { exact: true }),
  });
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: major }).click();
}

export async function selectMediumCategory(page: Page, medium: string) {
  const row = page.locator("div.flex.items-center.gap-2").filter({
    has: page.getByText("中分類", { exact: true }),
  });
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: medium }).click();
}

export async function switchToScenarioMode(page: Page) {
  await page
    .getByRole("group", { name: "対象の選び方" })
    .getByRole("button", { name: "シナリオ", exact: true })
    .click();
}

export async function selectScenario(page: Page, scenarioName: string) {
  const row = page.locator("div.flex.items-center.gap-2").filter({
    has: page.getByText("シナリオ", { exact: true }),
  });
  await row.getByRole("combobox").click();
  await page.getByRole("option", { name: scenarioName }).click();
}

/** Click a button inside the topmost open dialog. */
export async function clickDialogButton(page: Page, name: string) {
  const button = page.getByRole("dialog").last().getByRole("button", { name, exact: true });
  await expect(button).toBeVisible();
  await button.evaluate((el) => (el as HTMLButtonElement).click());
}
