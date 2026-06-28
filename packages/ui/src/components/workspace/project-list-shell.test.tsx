import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectListShell } from "./project-list-shell";
import type { ProjectListItem } from "./project-list-item";

const summaries: ProjectListItem[] = [
  {
    id: "demo",
    name: "Demo Project",
    updatedAt: "2026-06-28T12:00:00.000Z",
    hasValidSession: true,
  },
];

describe("ProjectListShell", () => {
  it("selects a project from the mobile sheet and closes it", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <ProjectListShell
        summaries={summaries}
        selectedId={null}
        lastOpenedProjectId={null}
        newProjectSelectionId="_new"
        onSelect={onSelect}
        showSessionBadge
      />,
    );

    await user.click(screen.getByRole("button", { name: "プロジェクト (2)" }));

    const demoButtons = await screen.findAllByRole("button", { name: /Demo Project/ });
    await user.click(demoButtons[0]!);

    expect(onSelect).toHaveBeenCalledWith("demo");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
