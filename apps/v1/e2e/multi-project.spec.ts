import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";
import { skipIntroCard, startSession, clickDialogButton } from "./helpers";
import {
  continueProjectFromHub,
  importPanel,
  loadAltProjectFromLoadPage,
  loadSampleFromLoadPage,
  openLoadPage,
  openProjectDetail,
  openProjectsHub,
  projectListItem,
  selectNewProjectInHub,
  uploadTestsYaml,
} from "./multi-project-helpers";

const ALT_TESTS_YAML = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "alt-tests.yml",
);

test.describe("multi-project hub", () => {
  test("shows import panel on fresh storage", async ({ page }) => {
    await openProjectsHub(page);
    await expect(page).toHaveURL(/\/projects(\?project=_new)?$/);
    await expect(page.getByText("新規作成", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "サンプルを試す" })).toBeVisible();
  });

  test("lists loaded sample project with continue action", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await openProjectsHub(page);

    await expect(projectListItem(page, "qarows")).toBeVisible();
    const panel = await openProjectDetail(page, "qarows");
    await expect(panel.getByText("qarows", { exact: true }).first()).toBeVisible();
    await expect(panel.getByRole("button", { name: "続ける" })).toBeVisible();
  });

  test("keeps existing project when loading another project id", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await loadAltProjectFromLoadPage(page);
    await openProjectsHub(page);

    await expect(projectListItem(page, "qarows")).toBeVisible();
    await expect(projectListItem(page, "Alt App QA")).toBeVisible();
  });

  test("continues each project with its own session state", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");

    await loadAltProjectFromLoadPage(page);
    await startSession(page, "alt-tester", "alt-app");

    await continueProjectFromHub(page, "qarows");
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);
    await skipIntroCard(page);
    await expect(page.getByRole("article").filter({ hasText: "TC-001" })).toBeVisible();

    await continueProjectFromHub(page, "Alt App QA");
    await expect(page).toHaveURL(/\/p\/alt-app\/run$/);
    await skipIntroCard(page);
    await expect(page.getByRole("article").filter({ hasText: "Alt project smoke test" })).toBeVisible();
  });

  test("continue navigates without inheriting test query from another project", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");
    await page.goto("/p/qarows/run?test=TC-002");

    await loadAltProjectFromLoadPage(page);
    await startSession(page, "alt-tester", "alt-app");
    await skipIntroCard(page);

    await continueProjectFromHub(page, "qarows");
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);
    expect(page.url()).not.toContain("test=");
  });
});

test.describe("multi-project import", () => {
  test("shows overwrite dialog for duplicate project id", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await openLoadPage(page);
    const panel = importPanel(page);
    await panel.getByRole("button", { name: "サンプルを試す" }).click();
    await panel.getByRole("button", { name: "読み込む", exact: true }).click();

    await expect(page.getByRole("heading", { name: "既存プロジェクトを上書きしますか？" })).toBeVisible();
    await clickDialogButton(page, "キャンセル");
    await expect(page).toHaveURL(/\/projects\?project=_new$/);
  });

  test("overwrites project after confirmation", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "before-overwrite");
    await openProjectsHub(page);
    const panel = await openProjectDetail(page, "qarows");
    await expect(panel.getByText("セッションあり")).toBeVisible();

    await selectNewProjectInHub(page);
    await uploadTestsYaml(page, ALT_TESTS_YAML, importPanel(page));
    await importPanel(page).getByRole("button", { name: "読み込む", exact: true }).click();
    await expect(page).toHaveURL(/\/p\/alt-app\/session$/);

    await openLoadPage(page);
    const importPanelLoc = importPanel(page);
    await importPanelLoc.getByRole("button", { name: "サンプルを試す" }).click();
    await importPanelLoc.getByRole("button", { name: "読み込む", exact: true }).click();
    await clickDialogButton(page, "上書きする");
    await expect(page).toHaveURL(/\/p\/qarows\/session$/);

    await openProjectsHub(page);
    await expect(projectListItem(page, "qarows")).toBeVisible();
    await expect(projectListItem(page, "Alt App QA")).toBeVisible();
  });
});

test.describe("multi-project management", () => {
  test("clears results from hub without deleting definition", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");
    await skipIntroCard(page);
    await page.getByRole("article").filter({ hasText: "TC-001" }).getByRole("button", { name: "一括 OK" }).click();

    await openProjectsHub(page);
    const panel = await openProjectDetail(page, "qarows");
    await panel.getByRole("button", { name: "結果をクリア" }).click();
    await clickDialogButton(page, "クリア");
    await expect(panel.getByText("テスト結果をクリアしました")).toBeVisible();

    await panel.getByRole("button", { name: "続ける" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/session$/);
  });

  test("deletes one project while keeping others", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await loadAltProjectFromLoadPage(page);
    await openProjectsHub(page);

    const panel = await openProjectDetail(page, "Alt App QA");
    await panel.getByRole("button", { name: "削除" }).click();
    await clickDialogButton(page, "削除");

    await expect(projectListItem(page, "Alt App QA")).toHaveCount(0);
    await expect(projectListItem(page, "qarows")).toBeVisible();
  });
});

test.describe("multi-project routing", () => {
  test("redirects unknown project id to hub", async ({ page }) => {
    await page.goto("/p/unknown-project/run");
    await expect(page).toHaveURL(/\/projects$/);
  });

  test("lazy-loads registered project from direct URL", async ({ page }) => {
    await loadAltProjectFromLoadPage(page);
    await page.goto("/p/alt-app/session");
    await expect(page).toHaveURL(/\/p\/alt-app\/session$/);
    await expect(page.getByLabel("実施者名")).toBeVisible();
  });

  test("sanitizes unknown test query on direct run URL", async ({ page }) => {
    await loadAltProjectFromLoadPage(page);
    await startSession(page, "alt-tester", "alt-app");
    await skipIntroCard(page);
    await page.goto("/p/alt-app/run?test=TC-999");
    await expect(page).toHaveURL(/\/p\/alt-app\/run$/);
    expect(page.url()).not.toContain("test=TC-999");
  });

  test("navigates to projects hub from compass menu", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");
    await page.getByRole("button", { name: "ナビゲーション" }).click();
    await page.getByRole("menuitem", { name: "プロジェクト一覧" }).click();
    await expect(page).toHaveURL(/\/projects(\?project=qarows)?$/);
  });

  test("landing continue opens last opened project", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");
    await page.goto("/");
    await page.getByRole("link", { name: "作業を続ける" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);
  });

  test("hub clear on another project does not change landing continue target", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");

    await loadAltProjectFromLoadPage(page);
    await startSession(page, "alt-tester", "alt-app");

    await continueProjectFromHub(page, "qarows");
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);

    await openProjectsHub(page);
    const panel = await openProjectDetail(page, "Alt App QA");
    await panel.getByRole("button", { name: "結果をクリア" }).click();
    await clickDialogButton(page, "クリア");
    await expect(panel.getByText("テスト結果をクリアしました")).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "作業を続ける" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);
  });
});
