import { serializeTestsYaml, slugifyProjectId } from "@qarows/shared";

/** 名前だけで作るときの最小 tests.yml。文字列連結は escape 漏れを生むので serializer に通す */
export function buildEmptyTestsYaml(name: string): string {
  const id = slugifyProjectId(name) || "project";
  return serializeTestsYaml({
    project: { name, id },
    environments: [{ id: "default", name: "Default" }],
    testCases: [
      {
        id: "TC-001",
        category: { major: "サンプル" },
        description: "最初のテストケース",
      },
    ],
  });
}
