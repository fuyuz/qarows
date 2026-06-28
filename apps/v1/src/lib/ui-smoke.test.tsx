import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingScreen } from "@/components/LoadingScreen";
import { StatusBadge } from "@/components/qa-ui";
import { projectPath } from "@/lib/project-routes";

describe("LoadingScreen", () => {
  it("shows loading message", () => {
    render(<LoadingScreen />);
    expect(screen.getByRole("status", { name: "読み込み中…" })).toBeInTheDocument();
  });

  it("accepts a custom message", () => {
    render(<LoadingScreen message="プロジェクトを切り替えています…" />);
    expect(
      screen.getByRole("status", { name: "プロジェクトを切り替えています…" }),
    ).toBeInTheDocument();
  });
});

describe("StatusBadge", () => {
  it("renders SKIP label", () => {
    render(<StatusBadge status="SKIP" />);
    expect(screen.getByText("SKIP")).toBeInTheDocument();
  });
});

describe("projectPath", () => {
  it("builds project-scoped run URL", () => {
    expect(projectPath("qarows", "run")).toBe("/p/qarows/run");
  });

  it("encodes project id and appends query", () => {
    expect(
      projectPath("my project", "run", {
        onlyIncomplete: true,
        onlyWithBugs: false,
        onlyWithNg: false,
      }, "TC-001"),
    ).toBe("/p/my%20project/run?filters=incomplete&test=TC-001");
  });
});
