import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type Locator } from "@playwright/test";

const FIXTURES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

export async function openProjectsHub(page: Page) {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "プロジェクト", level: 1 })).toBeVisible();
}

export async function openLoadPage(page: Page) {
  await page.goto("/load");
  await expect(page).toHaveURL(/\/projects\?project=_new$/);
  await expect(importPanel(page)).toBeVisible();
}

export async function selectNewProjectInHub(page: Page) {
  await page
    .getByRole("complementary", { name: "プロジェクト一覧" })
    .getByRole("button", { name: "新規作成" })
    .click();
  await expect(page).toHaveURL(/\/projects\?project=_new$/);
  await expect(importPanel(page)).toBeVisible();
}

export async function selectProjectInHub(page: Page, projectName: string) {
  await page
    .getByRole("complementary", { name: "プロジェクト一覧" })
    .getByRole("button")
    .filter({ hasText: projectName })
    .first()
    .click();
}

export function projectListItem(page: Page, projectName: string): Locator {
  return page
    .getByRole("complementary", { name: "プロジェクト一覧" })
    .getByRole("button")
    .filter({ hasText: projectName });
}

/** Import UI on /projects?project=_new (ignores crossfading exit panel). */
export function importPanel(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({
      has: page.locator('[data-slot="card-title"]').filter({ hasText: /^新規作成$/ }),
    })
    .filter({ has: page.getByRole("button", { name: "サンプルを試す" }) })
    .last();
}

/** Registered project detail panel (ignores crossfading exit panel). */
export function projectDetailPanel(page: Page): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("button", { name: "続ける" }) })
    .filter({ hasNot: page.getByRole("button", { name: "サンプルを試す" }) })
    .last();
}

export async function openProjectDetail(page: Page, projectName: string): Promise<Locator> {
  await selectProjectInHub(page, projectName);
  const panel = projectDetailPanel(page);
  await expect(panel.getByRole("button", { name: "続ける" })).toBeVisible();
  return panel;
}

/** @deprecated Use openProjectDetail or projectListItem instead */
export function projectCard(page: Page, projectName: string): Locator {
  return projectDetailPanel(page).filter({ hasText: projectName });
}

export async function uploadTestsYaml(page: Page, filePath: string, panel: Locator = importPanel(page)) {
  await panel.locator('input[type="file"]').setInputFiles(filePath);
}

export async function loadSampleFromLoadPage(page: Page) {
  await openLoadPage(page);
  const panel = importPanel(page);
  await panel.getByRole("button", { name: "サンプルを試す" }).click();
  await expect(panel.getByText("tests.yml", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "読み込む", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/qarows\/session$/);
}

export async function loadAltProjectFromLoadPage(page: Page) {
  await openProjectsHub(page);
  await selectNewProjectInHub(page);
  const panel = importPanel(page);
  await uploadTestsYaml(page, path.join(FIXTURES_DIR, "alt-tests.yml"), panel);
  await expect(panel.getByText("alt-tests.yml")).toBeVisible();
  await panel.getByRole("button", { name: "読み込む", exact: true }).click();
  await expect(page).toHaveURL(/\/p\/alt-app\/session$/);
}

export async function continueProjectFromHub(page: Page, projectName: string) {
  await openProjectsHub(page);
  const panel = await openProjectDetail(page, projectName);
  await panel.getByRole("button", { name: "続ける" }).click();
}
