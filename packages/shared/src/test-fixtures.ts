import type { TestDefinition } from "./types";

export function makeDefinition(overrides: Partial<TestDefinition> = {}): TestDefinition {
  return {
    project: { name: "Test", id: "test" },
    environments: [
      { id: "chrome", name: "Chrome" },
      { id: "firefox", name: "Firefox" },
      { id: "safari", name: "Safari" },
    ],
    testCases: [
      {
        id: "TC-001",
        category: { major: "Auth", medium: "Login" },
        description: "Can log in",
      },
      {
        id: "TC-002",
        category: { major: "Auth", medium: "Logout" },
        description: "Can log out",
      },
      {
        id: "TC-003",
        category: { major: "Billing" },
        description: "Invoice renders",
      },
    ],
    ...overrides,
  };
}
