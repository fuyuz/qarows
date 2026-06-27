import {
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  type Bug,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";

export function formatBugMarkdown({
  definition,
  bug,
  relatedTestCase,
}: {
  definition: TestDefinition;
  bug: Bug;
  relatedTestCase?: TestCase;
}): string {
  const projectId = definition.project.id ?? definition.project.name;
  const envNameById = new Map(definition.environments.map((env) => [env.id, env.name]));
  const envNames = (bug.environmentIds ?? []).map((id) => envNameById.get(id) ?? id);

  const lines = [
    `# Bug: ${bug.id}`,
    "",
    `Project: ${definition.project.name} (${projectId})`,
    "",
    "## Summary",
    bug.title,
    "",
    "## Status",
    `- Status: ${bug.status} (${BUG_STATUS_LABELS[bug.status]})`,
    `- Severity: ${bug.severity} (${BUG_SEVERITY_LABELS[bug.severity]})`,
  ];

  if (bug.assignee) {
    lines.push("", "## Assignee", bug.assignee);
  }

  if (bug.testCaseId) {
    lines.push("", "## Related Test Case", `- ID: ${bug.testCaseId}`);
    if (relatedTestCase) {
      lines.push(`- Description: ${relatedTestCase.description}`);
      if (relatedTestCase.prerequisites) {
        lines.push(`- Prerequisites: ${relatedTestCase.prerequisites}`);
      }
    }
  }

  if (envNames.length > 0) {
    lines.push("", "## Environments", envNames.join(", "));
  }

  if (bug.steps) {
    lines.push("", "## Steps", bug.steps);
  }

  if (bug.expected) {
    lines.push("", "## Expected", bug.expected);
  }

  if (bug.actual) {
    lines.push("", "## Actual", bug.actual);
  }

  if (bug.memo) {
    lines.push("", "## Memo", bug.memo);
  }

  if (bug.fixNote) {
    lines.push("", "## Fix", bug.fixNote);
  }

  return `${lines.join("\n")}\n`;
}
