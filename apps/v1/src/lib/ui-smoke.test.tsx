import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StatusBadge } from "@/components/qa-ui";
import { projectPath } from "@/lib/project-routes";

describe("LoadingScreen", () => {
  it("shows loading message", () => {
    render(<LoadingScreen />);
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders OK→NG label", () => {
    render(<StatusBadge status="OK_NG" />);
    expect(screen.getByText("OK→NG")).toBeInTheDocument();
  });
});

describe("projectPath", () => {
  it("builds project-scoped run URL", () => {
    expect(projectPath("qarows", "run")).toBe("/p/qarows/run");
  });

  it("encodes project id and appends query", () => {
    expect(
      projectPath("my project", "run", { onlyIncomplete: true }, "TC-001"),
    ).toBe("/p/my%20project/run?incomplete=1&test=TC-001");
  });
});
