import yaml from "js-yaml";
import type {
  CategoryTarget,
  Environment,
  TargetEnvironmentSpec,
  TestCase,
  TestDefinition,
  TestScenario,
} from "./types";
import { getTestCaseVersion } from "./test-case-version";

function serializeTargetEnvironmentSpec(spec: TargetEnvironmentSpec): Record<string, unknown> {
  const obj: Record<string, unknown> = { required: spec.required };
  if (spec.targets && spec.targets.length > 0) {
    obj.targets = [...spec.targets];
  }
  return obj;
}

function serializeCategoryTarget(ct: CategoryTarget): Record<string, unknown> {
  const match: Record<string, unknown> = { major: ct.match.major };
  if (ct.match.medium) match.medium = ct.match.medium;
  if (ct.match.minor) match.minor = ct.match.minor;

  const obj: Record<string, unknown> = { match };
  if (ct.required != null && ct.required !== "all") obj.required = ct.required;
  if (ct.targets && ct.targets.length > 0) obj.targets = [...ct.targets];
  return obj;
}

function serializeTestCase(tc: TestCase): Record<string, unknown> {
  const category: Record<string, unknown> = { major: tc.category.major };
  if (tc.category.medium) category.medium = tc.category.medium;
  if (tc.category.minor) category.minor = tc.category.minor;

  const obj: Record<string, unknown> = {
    id: tc.id,
    category,
    description: tc.description,
  };

  const version = getTestCaseVersion(tc);
  if (version > 1) obj.version = version;
  if (tc.prerequisites) obj.prerequisites = tc.prerequisites;
  if (tc.targetEnvironments) {
    obj.targetEnvironments = serializeTargetEnvironmentSpec(tc.targetEnvironments);
  }
  return obj;
}

function serializeScenario(scenario: TestScenario): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    id: scenario.id,
    name: scenario.name,
    steps: [...scenario.steps],
  };
  if (scenario.description) obj.description = scenario.description;
  return obj;
}

function serializeEnvironment(env: Environment): string | Record<string, unknown> {
  if (env.name === env.id) return env.id;
  return { id: env.id, name: env.name };
}

export function serializeTestsYaml(definition: TestDefinition): string {
  const project: Record<string, unknown> = { name: definition.project.name };
  if (definition.project.id) project.id = definition.project.id;
  if (definition.project.version != null && definition.project.version !== 1) {
    project.version = definition.project.version;
  }

  const payload: Record<string, unknown> = {
    project,
    environments: definition.environments.map(serializeEnvironment),
    testCases: definition.testCases.map(serializeTestCase),
  };

  if (definition.categoryTargets && definition.categoryTargets.length > 0) {
    payload.categoryTargets = definition.categoryTargets.map(serializeCategoryTarget);
  }
  if (definition.scenarios && definition.scenarios.length > 0) {
    payload.scenarios = definition.scenarios.map(serializeScenario);
  }

  return `${yaml.dump(payload, { lineWidth: 120, noRefs: true })}`;
}
