import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectOverwriteDialog } from "./project-overwrite-dialog";

describe("ProjectOverwriteDialog", () => {
  it("calls onConfirm when overwrite is chosen", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectOverwriteDialog
        open
        projectName="Demo"
        projectId="demo"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "上書きする" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ProjectOverwriteDialog
        open
        projectName="Demo"
        projectId="demo"
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables confirm while loading", () => {
    render(
      <ProjectOverwriteDialog
        open
        projectName="Demo"
        projectId="demo"
        loading
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "読み込み中…" })).toBeDisabled();
  });
});
