import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "./fixtures";
import { skipIntroCard, startSession } from "./helpers";
import {
  continueProjectFromHub,
  loadAltProjectFromLoadPage,
  loadSampleFromLoadPage,
  openLoadPage,
  openProjectsHub,
  projectCard,
  uploadTestsYaml,
} from "./multi-project-helpers";

const ALT_TESTS_YAML = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "alt-tests.yml",
);

test.describe("multi-project hub", () => {
  test("shows empty state on fresh storage", async ({ page }) => {
    await openProjectsHub(page);
    await expect(page.getByText("プロジェクトがありません")).toBeVisible();
    await page.getByRole("button", { name: "tests.yml を読み込む" }).click();
    await expect(page).toHaveURL(/\/load$/);
  });

  test("lists loaded sample project with continue action", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await openProjectsHub(page);

    const card = projectCard(page, "qarows");
    await expect(card).toBeVisible();
    await expect(card.getByText("qarows", { exact: true }).first()).toBeVisible();
    await expect(card.getByRole("button", { name: "続ける" })).toBeVisible();
  });

  test("keeps existing project when loading another project id", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await loadAltProjectFromLoadPage(page);
    await openProjectsHub(page);

    await expect(projectCard(page, "qarows")).toBeVisible();
    await expect(projectCard(page, "Alt App QA")).toBeVisible();
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
    await page.getByRole("button", { name: "サンプルを試す" }).click();
    await page.getByRole("button", { name: "読み込む" }).click();

    await expect(page.getByRole("heading", { name: "既存プロジェクトを上書きしますか？" })).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();
    await expect(page).toHaveURL(/\/load$/);
  });

  test("overwrites project after confirmation", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "before-overwrite");
    await openProjectsHub(page);
    await expect(projectCard(page, "qarows").getByText("セッションあり")).toBeVisible();

    await openLoadPage(page);
    await uploadTestsYaml(page, ALT_TESTS_YAML);
    await page.getByRole("button", { name: "読み込む" }).click();
    await expect(page).toHaveURL(/\/p\/alt-app\/session$/);

    await openLoadPage(page);
    await page.getByRole("button", { name: "サンプルを試す" }).click();
    await page.getByRole("button", { name: "読み込む" }).click();
    await page.getByRole("button", { name: "上書きする" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/session$/);

    await openProjectsHub(page);
    await expect(projectCard(page, "qarows")).toBeVisible();
    await expect(projectCard(page, "Alt App QA")).toBeVisible();
  });
});

test.describe("multi-project management", () => {
  test("clears results from hub without deleting definition", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await startSession(page, "qarows-tester");
    await skipIntroCard(page);
    await page.getByRole("article").filter({ hasText: "TC-001" }).getByRole("button", { name: "一括 OK" }).click();

    await openProjectsHub(page);
    const card = projectCard(page, "qarows");
    await card.getByRole("button", { name: "結果をクリア" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "クリア" }).click();
    await expect(card.getByText("テスト結果をクリアしました")).toBeVisible();

    await card.getByRole("button", { name: "続ける" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/session$/);
  });

  test("deletes one project while keeping others", async ({ page }) => {
    await loadSampleFromLoadPage(page);
    await loadAltProjectFromLoadPage(page);
    await openProjectsHub(page);

    const altCard = projectCard(page, "Alt App QA");
    await altCard.getByRole("button", { name: "削除" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "削除" }).click();

    await expect(projectCard(page, "Alt App QA")).toHaveCount(0);
    await expect(projectCard(page, "qarows")).toBeVisible();
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
    await expect(page).toHaveURL(/\/projects$/);
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
    const altCard = projectCard(page, "Alt App QA");
    await altCard.getByRole("button", { name: "結果をクリア" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "クリア" }).click();
    await expect(altCard.getByText("テスト結果をクリアしました")).toBeVisible();

    await page.goto("/");
    await page.getByRole("link", { name: "作業を続ける" }).click();
    await expect(page).toHaveURL(/\/p\/qarows\/run$/);
  });
});
