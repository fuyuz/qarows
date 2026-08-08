import {
  bugSeverityLabels,
  bugStatusLabels,
  getTestCaseVersion,
  type Bug,
  type Environment,
  type SessionTestTargets,
  type TestCase,
  type TestDefinition,
  type TranslateFn,
} from "@qarows/shared";

function formatTargetEnvironments(
  envTargets: SessionTestTargets,
  environments: Environment[],
  t: TranslateFn,
): string {
  const envNameById = new Map(environments.map((env) => [env.id, env.name]));
  const names = envTargets.environmentIds.map((id) => envNameById.get(id) ?? id);
  return `- Required: ${envTargets.required}\n- In scope: ${names.length > 0 ? names.join(", ") : t("definition.noneInScope")}`;
}

function formatBugSection(bugs: Bug[], t: TranslateFn): string {
  if (bugs.length === 0) return "";

  const statusLabels = bugStatusLabels(t);
  const severityLabels = bugSeverityLabels(t);
  const lines = [`## Related Bugs (${bugs.length})`, ""];

  for (const bug of bugs) {
    lines.push(`### ${bug.id}: ${bug.title}`);
    lines.push(`- Status: ${bug.status} (${statusLabels[bug.status]})`);
    lines.push(`- Severity: ${bug.severity} (${severityLabels[bug.severity]})`);
    if (bug.assignee) lines.push(`- Assignee: ${bug.assignee}`);
    if (bug.environmentIds?.length) lines.push(`- Environments: ${bug.environmentIds.join(", ")}`);
    if (bug.steps) lines.push(`- Steps:\n${bug.steps}`);
    if (bug.expected) lines.push(`- Expected:\n${bug.expected}`);
    if (bug.actual) lines.push(`- Actual:\n${bug.actual}`);
    if (bug.fixNote) lines.push(`- Fix:\n${bug.fixNote}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatTestCaseMarkdown({
  definition,
  testCase,
  envTargets,
  bugs,
  t,
}: {
  definition: TestDefinition;
  testCase: TestCase;
  envTargets: SessionTestTargets;
  bugs: Bug[];
  t: TranslateFn;
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
  lines.push("", "## Target Environments", formatTargetEnvironments(envTargets, definition.environments, t));

  const bugSection = formatBugSection(bugs, t);
  if (bugSection) {
    lines.push("", bugSection);
  }

  return `${lines.join("\n")}\n`;
}
