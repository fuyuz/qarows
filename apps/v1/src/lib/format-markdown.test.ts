import { describe, expect, it } from "vitest";
import { resolveSessionTestTargets } from "@qarows/shared";
import { makeDefinition } from "@qarows/shared/test-fixtures";
import { formatBugMarkdown } from "@/lib/format-bug-markdown";
import { formatTestCaseMarkdown } from "@/lib/format-test-case-markdown";

describe("formatTestCaseMarkdown", () => {
  it("includes category, description, and related bugs", () => {
    const definition = makeDefinition({
      testCases: [
        {
          id: "TC-001",
          version: 2,
          category: { major: "Auth", medium: "Login" },
          prerequisites: "Signed out",
          description: "Can log in",
        },
      ],
    });
    const testCase = definition.testCases[0]!;
    const envTargets = resolveSessionTestTargets(testCase, definition, ["chrome"]);
    const md = formatTestCaseMarkdown({
      definition,
      testCase,
      envTargets,
      bugs: [
        {
          id: "BUG-001",
          title: "Crash",
          severity: "high",
          status: "open",
          testCaseId: "TC-001",
        },
      ],
    });

    expect(md).toContain("# Test Case: TC-001");
    expect(md).toContain("Version: 2");
    expect(md).toContain("Signed out");
    expect(md).toContain("Can log in");
    expect(md).toContain("Related Bugs");
    expect(md).toContain("BUG-001: Crash");
  });
});

describe("formatBugMarkdown", () => {
  it("includes status labels and related test case", () => {
    const definition = makeDefinition();
    const testCase = definition.testCases[0]!;
    const md = formatBugMarkdown({
      definition,
      bug: {
        id: "BUG-001",
        title: "Layout broken",
        severity: "medium",
        status: "in_progress",
        testCaseId: "TC-001",
        environmentIds: ["chrome"],
        steps: "Open page",
      },
      relatedTestCase: testCase,
    });

    expect(md).toContain("# Bug: BUG-001");
    expect(md).toContain("Layout broken");
    expect(md).toContain("修正中");
    expect(md).toContain("Can log in");
    expect(md).toContain("Chrome");
  });
});
