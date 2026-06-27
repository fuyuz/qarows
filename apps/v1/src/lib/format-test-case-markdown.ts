import {
  BUG_SEVERITY_LABELS,
  BUG_STATUS_LABELS,
  getTestCaseVersion,
  type Bug,
  type Environment,
  type SessionTestTargets,
  type TestCase,
  type TestDefinition,
} from "@qarows/shared";

function formatTargetEnvironments(
  envTargets: SessionTestTargets,
  environments: Environment[],
): string {
  const envNameById = new Map(environments.map((env) => [env.id, env.name]));
  const names = envTargets.environmentIds.map((id) => envNameById.get(id) ?? id);
  return `- Required: ${envTargets.required}\n- In scope: ${names.length > 0 ? names.join(", ") : "（なし）"}`;
}

function formatBugSection(bugs: Bug[]): string {
  if (bugs.length === 0) return "";

  const lines = [`## Related Bugs (${bugs.length})`, ""];

  for (const bug of bugs) {
    lines.push(`### ${bug.id}: ${bug.title}`);
    lines.push(`- Status: ${bug.status} (${BUG_STATUS_LABELS[bug.status]})`);
    lines.push(`- Severity: ${bug.severity} (${BUG_SEVERITY_LABELS[bug.severity]})`);
    if (bug.assignee) lines.push(`- Assignee: ${bug.assignee}`);
    if (bug.environmentIds?.length) lines.push(`- Environments: ${bug.environmentIds.join(", ")}`);
    if (bug.steps) lines.push(`- Steps:\n${bug.steps}`);
    if (bug.expected) lines.push(`- Expected:\n${bug.expected}`);
    if (bug.actual) lines.push(`- Actual:\n${bug.actual}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatTestCaseMarkdown({
  definition,
  testCase,
  envTargets,
  bugs,
}: {
  definition: TestDefinition;
  testCase: TestCase;
  envTargets: SessionTestTargets;
  bugs: Bug[];
}): string {
  const projectId = definition.project.id ?? definition.project.name;
  const version = getTestCaseVersion(testCase);

  const lines = [
    `# Test Case: ${testCase.id}`,
    "",
    `Project: ${definition.project.name} (${projectId})`,
  ];

  if (version > 1) lines.push(`Version: ${version}`);

  lines.push(
    "",
    "## Category",
    `- Major: ${testCase.category.major}`,
  );

  if (testCase.category.medium) lines.push(`- Medium: ${testCase.category.medium}`);
  if (testCase.category.minor) lines.push(`- Minor: ${testCase.category.minor}`);

  if (testCase.prerequisites) {
    lines.push("", "## Prerequisites", testCase.prerequisites);
  }

  lines.push("", "## Description", testCase.description);
  lines.push("", "## Target Environments", formatTargetEnvironments(envTargets, definition.environments));

  const bugSection = formatBugSection(bugs);
  if (bugSection) {
    lines.push("", bugSection);
  }

  return `${lines.join("\n")}\n`;
}
