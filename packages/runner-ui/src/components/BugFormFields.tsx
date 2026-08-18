import type { BugSeverity, BugStatus, Environment, TestCase } from "@qarows/shared";
import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "@qarows/ui";
import { Checkbox } from "@qarows/ui";
import { Input } from "@qarows/ui";
import { Label } from "@qarows/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qarows/ui";
import { Textarea } from "@qarows/ui";
import { useRunnerWorkspace } from "../context/runner-workspace";
import { useBugLabels } from "../hooks/useBugLabels";
import { BugAttachmentsField } from "./BugAttachmentsField";
import type { BugDialogDraft } from "./BugDialog";

const NONE_TEST_CASE = "__none__";
const BUG_SEVERITIES: BugSeverity[] = ["low", "medium", "high", "critical"];
const BUG_STATUSES: BugStatus[] = ["open", "in_progress", "fixed", "resolved", "wont_fix"];

export function BugFormFields({
  idPrefix,
  testCase,
  testCases,
  environments,
  availableEnvironmentIds,
  draft,
  setDraft,
  titleError,
  setTitleError,
}: {
  idPrefix: string;
  testCase?: TestCase;
  testCases?: TestCase[];
  environments: Environment[];
  availableEnvironmentIds: string[];
  draft: BugDialogDraft;
  setDraft: Dispatch<SetStateAction<BugDialogDraft>>;
  titleError: boolean;
  setTitleError: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const { statusLabels, severityLabels } = useBugLabels();
  const { attachments: attachmentsAdapter } = useRunnerWorkspace();
  const envNameById = new Map(environments.map((env) => [env.id, env.name]));
  const selectableTestCases = testCases ?? (testCase ? [testCase] : []);
  const showFixNote = draft.status === "fixed" || draft.status === "resolved";

  const toggleEnvironment = (envId: string, checked: boolean) => {
    setDraft((prev) => ({
      ...prev,
      environmentIds: checked
        ? [...prev.environmentIds, envId]
        : prev.environmentIds.filter((id) => id !== envId),
    }));
  };

  return (
    <div className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-test-case`}>{t("bug.relatedTestCase")}</Label>
        <Select
          value={draft.testCaseId ?? NONE_TEST_CASE}
          onValueChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              testCaseId: value === NONE_TEST_CASE ? undefined : value,
            }))
          }
        >
          <SelectTrigger id={`${idPrefix}-test-case`} className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {selectableTestCases.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.id} — {entry.description}
              </SelectItem>
            ))}
            <SelectItem value={NONE_TEST_CASE}>{t("common.none")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid min-w-0 gap-2">
        <Label>{t("bug.targetEnvironments")}</Label>
        <ul className="flex flex-col gap-2 rounded-lg border p-3">
          {availableEnvironmentIds.map((envId) => {
            const checked = draft.environmentIds.includes(envId);
            return (
              <li key={envId}>
                <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) => toggleEnvironment(envId, value === true)}
                  />
                  <span>{envNameById.get(envId) ?? envId}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-title`}>{t("bug.title")}</Label>
        <Input
          id={`${idPrefix}-title`}
          value={draft.title}
          aria-invalid={titleError}
          placeholder={t("bug.titlePlaceholder")}
          onChange={(e) => {
            setTitleError(false);
            setDraft((prev) => ({ ...prev, title: e.target.value }));
          }}
        />
        {titleError && <p className="text-sm text-destructive">{t("bug.titleRequired")}</p>}
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${idPrefix}-severity`}>{t("runner.severity")}</Label>
          <Select
            value={draft.severity}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, severity: value as BugSeverity }))
            }
          >
            <SelectTrigger id={`${idPrefix}-severity`} className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUG_SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {severityLabels[severity]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${idPrefix}-status`}>{t("runner.status")}</Label>
          <Select
            value={draft.status}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, status: value as BugStatus }))
            }
          >
            <SelectTrigger id={`${idPrefix}-status`} className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUG_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-assignee`}>{t("bug.assignee")}</Label>
        <Input
          id={`${idPrefix}-assignee`}
          value={draft.assignee}
          placeholder={t("common.optional")}
          onChange={(e) => setDraft((prev) => ({ ...prev, assignee: e.target.value }))}
        />
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-memo`}>{t("runner.memo")}</Label>
        <Textarea
          id={`${idPrefix}-memo`}
          rows={3}
          value={draft.memo}
          placeholder={t("bug.memoOptionalFreeform")}
          onChange={(e) => setDraft((prev) => ({ ...prev, memo: e.target.value }))}
        />
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-steps`}>{t("bug.reproSteps")}</Label>
        <Textarea
          id={`${idPrefix}-steps`}
          rows={4}
          value={draft.steps}
          onChange={(e) => setDraft((prev) => ({ ...prev, steps: e.target.value }))}
        />
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-expected`}>{t("bug.expected")}</Label>
        <Textarea
          id={`${idPrefix}-expected`}
          rows={2}
          value={draft.expected}
          onChange={(e) => setDraft((prev) => ({ ...prev, expected: e.target.value }))}
        />
      </div>

      <div className="grid min-w-0 gap-2">
        <Label htmlFor={`${idPrefix}-actual`}>{t("bug.actual")}</Label>
        <Textarea
          id={`${idPrefix}-actual`}
          rows={2}
          value={draft.actual}
          placeholder={t("common.optional")}
          onChange={(e) => setDraft((prev) => ({ ...prev, actual: e.target.value }))}
        />
      </div>

      {attachmentsAdapter && (
        <BugAttachmentsField
          idPrefix={idPrefix}
          adapter={attachmentsAdapter}
          draft={draft}
          setDraft={setDraft}
        />
      )}

      {showFixNote && (
        <div className="grid min-w-0 gap-2">
          <Label htmlFor={`${idPrefix}-fix-note`}>{t("bug.fixNote")}</Label>
          <Textarea
            id={`${idPrefix}-fix-note`}
            rows={3}
            value={draft.fixNote}
            placeholder={t("bug.fixNoteRecordPlaceholder")}
            onChange={(e) => setDraft((prev) => ({ ...prev, fixNote: e.target.value }))}
          />
        </div>
      )}
    </div>
  );
}
