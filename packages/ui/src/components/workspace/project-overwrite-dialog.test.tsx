import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n/context";
import { ProjectOverwriteDialog } from "./project-overwrite-dialog";

function renderDialog(props: ComponentProps<typeof ProjectOverwriteDialog>) {
  return render(
    <I18nProvider initialLocale="ja">
      <ProjectOverwriteDialog {...props} />
    </I18nProvider>,
  );
}

describe("ProjectOverwriteDialog", () => {
  it("calls onConfirm when overwrite is chosen", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderDialog({
      open: true,
      projectName: "Demo",
      projectId: "demo",
      onOpenChange: vi.fn(),
      onConfirm,
      onCancel,
    });

    await user.click(screen.getByRole("button", { name: "上書きする" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel when cancelled", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderDialog({
      open: true,
      projectName: "Demo",
      projectId: "demo",
      onOpenChange: vi.fn(),
      onConfirm,
      onCancel,
    });

    await user.click(screen.getByRole("button", { name: "キャンセル" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("disables confirm while loading", () => {
    renderDialog({
      open: true,
      projectName: "Demo",
      projectId: "demo",
      loading: true,
      onOpenChange: vi.fn(),
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    });

    expect(screen.getByRole("button", { name: "読み込み中…" })).toBeDisabled();
  });
});
