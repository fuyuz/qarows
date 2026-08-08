import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "../../i18n/context";
import { SessionSetupForm } from "./session-setup-form";

const environments = [
  { id: "chrome", name: "Chrome" },
  { id: "firefox", name: "Firefox" },
];

function renderForm(props: ComponentProps<typeof SessionSetupForm>) {
  return render(
    <I18nProvider initialLocale="ja">
      <SessionSetupForm {...props} />
    </I18nProvider>,
  );
}

describe("SessionSetupForm", () => {
  it("shows validation error when submitting without required fields", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm({
      projectName: "Demo",
      environments,
      disableSubmitUntilValid: false,
      onSubmit,
    });

    await user.click(screen.getByRole("button", { name: "テスト実行を開始" }));

    expect(await screen.findByText("実施者名を入力してください")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits fixed executor name when provided", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm({
      projectName: "Demo",
      environments,
      fixedExecutorName: "qa@example.com",
      onSubmit,
    });

    await user.click(screen.getAllByRole("checkbox")[0]!);
    await user.click(screen.getByRole("button", { name: "テスト実行を開始" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        executorName: "qa@example.com",
        selectedEnvironmentIds: ["chrome"],
      });
    });
  });

  it("submits trimmed session when valid", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm({
      projectName: "Demo",
      environments,
      onSubmit,
    });

    await user.type(screen.getByLabelText(/実施者名/), "  tanaka  ");
    await user.click(screen.getAllByRole("checkbox")[0]!);
    await user.click(screen.getByRole("button", { name: "テスト実行を開始" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        executorName: "tanaka",
        selectedEnvironmentIds: ["chrome"],
      });
    });
  });

  it("shows submit failure message", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("保存に失敗"));

    renderForm({
      projectName: "Demo",
      environments,
      initialExecutorName: "qa",
      initialSelectedEnvIds: ["chrome"],
      onSubmit,
    });

    await user.click(screen.getByRole("button", { name: "テスト実行を開始" }));

    expect(await screen.findByText("保存に失敗")).toBeInTheDocument();
  });

  it("disables submit until valid when disableSubmitUntilValid is true", () => {
    renderForm({
      projectName: "Demo",
      environments,
      disableSubmitUntilValid: true,
      onSubmit: vi.fn(),
    });

    expect(screen.getByRole("button", { name: "テスト実行を開始" })).toBeDisabled();
  });
});
