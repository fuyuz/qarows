import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

export async function openProjectsHub(page: Page) {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "プロジェクト" })).toBeVisible();
}

export async function openLoadPage(page: Page) {
  await page.goto("/load");
  await expect(page.getByRole("heading", { name: "プロジェクトを追加" })).toBeVisible();
}

export async function uploadTestsYaml(page: Page, filePath: string) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);
}

export async function loadSampleFromLoadPage(page: Page) {
  await openLoadPage(page);
  await page.getByRole("button", { name: "サンプルを試す" }).click();
  await expect(page.getByText("tests.yml", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "読み込む" }).click();
  await expect(page).toHaveURL(/\/p\/qarows\/session$/);
}

export async function loadAltProjectFromLoadPage(page: Page) {
  await openLoadPage(page);
  await uploadTestsYaml(page, path.join(FIXTURES_DIR, "alt-tests.yml"));
  await expect(page.getByText("alt-tests.yml")).toBeVisible();
  await page.getByRole("button", { name: "読み込む" }).click();
  await expect(page).toHaveURL(/\/p\/alt-app\/session$/);
}

export function projectCard(page: Page, projectName: string) {
  return page.locator('[data-slot="card"]').filter({ hasText: projectName });
}

export async function continueProjectFromHub(page: Page, projectName: string) {
  await openProjectsHub(page);
  await projectCard(page, projectName).getByRole("button", { name: "続ける" }).click();
}
