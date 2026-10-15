import type { SessionTestTargets, TestCase } from "@qarows/shared";
import type { Dispatch, SetStateAction } from "react";
import { Input } from "@qarows/ui";
import { Label } from "@qarows/ui";
import { Textarea, useTranslation } from "@qarows/ui";

export function TestCaseFormFields({
  idPrefix,
  envTargets,
  draft,
  setDraft,
  majorError,
  setMajorError,
  descriptionError,
  setDescriptionError,
}: {
  idPrefix: string;
  envTargets: SessionTestTargets;
  draft: TestCaseEditDraft;
  setDraft: Dispatch<SetStateAction<TestCaseEditDraft>>;
  majorError: boolean;
  setMajorError: (value: boolean) => void;
  descriptionError: boolean;
  setDescriptionError: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const envSummary =
    envTargets.environmentIds.length > 0
      ? `${envTargets.required} — ${envTargets.environmentIds.join(", ")}`
      : t("runner.outOfScope");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-targets`}>{t("definition.targetDevicesReadonly")}</Label>
        <Input
          id={`${idPrefix}-targets`}
          value={envSummary}
          readOnly
          disabled
          className="bg-muted/50"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-major`}>{t("runner.major")}</Label>
          <Input
            id={`${idPrefix}-major`}
            value={draft.major}
            aria-invalid={majorError}
            onChange={(e) => {
              setMajorError(false);
              setDraft((prev) => ({ ...prev, major: e.target.value }));
            }}
          />
          {majorError && <p className="text-sm text-destructive">{t("definition.majorRequired")}</p>}
        </div>
        <div className="grid gap-2 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-medium`}>{t("runner.medium")}</Label>
          <Input
            id={`${idPrefix}-medium`}
            value={draft.medium}
            placeholder={t("common.optional")}
            onChange={(e) => setDraft((prev) => ({ ...prev, medium: e.target.value }))}
          />
        </div>
        <div className="grid gap-2 sm:col-span-1">
          <Label htmlFor={`${idPrefix}-minor`}>{t("runner.minor")}</Label>
          <Input
            id={`${idPrefix}-minor`}
            value={draft.minor}
            placeholder={t("common.optional")}
            onChange={(e) => setDraft((prev) => ({ ...prev, minor: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-prerequisites`}>{t("runner.prerequisites")}</Label>
        <Textarea
          id={`${idPrefix}-prerequisites`}
          rows={2}
          value={draft.prerequisites}
          placeholder={t("common.optional")}
          onChange={(e) => setDraft((prev) => ({ ...prev, prerequisites: e.target.value }))}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>{t("runner.steps")}</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={4}
          value={draft.description}
          aria-invalid={descriptionError}
          onChange={(e) => {
            setDescriptionError(false);
            setDraft((prev) => ({ ...prev, description: e.target.value }));
          }}
        />
        {descriptionError && <p className="text-sm text-destructive">{t("definition.stepsRequired")}</p>}
      </div>
    </div>
  );
}

export interface TestCaseEditDraft {
  major: string;
  medium: string;
  minor: string;
  prerequisites: string;
  description: string;
  bumpVersion: boolean;
}

export function testCaseToDraft(testCase: TestCase): TestCaseEditDraft {
  return {
    major: testCase.category.major,
    medium: testCase.category.medium ?? "",
    minor: testCase.category.minor ?? "",
    prerequisites: testCase.prerequisites ?? "",
    description: testCase.description,
    bumpVersion: false,
  };
}

export function normalizeTestCaseDraft(draft: TestCaseEditDraft): TestCaseEditDraft {
  return {
    major: draft.major.trim(),
    medium: draft.medium.trim(),
    minor: draft.minor.trim(),
    prerequisites: draft.prerequisites.trim(),
    description: draft.description.trim(),
    bumpVersion: draft.bumpVersion,
  };
}

export function isTestCaseDraftDirty(testCase: TestCase, draft: TestCaseEditDraft): boolean {
  if (draft.bumpVersion) return true;
  const normalized = normalizeTestCaseDraft(draft);
  if (normalized.major !== testCase.category.major) return true;
  if (normalized.medium !== (testCase.category.medium ?? "")) return true;
  if (normalized.minor !== (testCase.category.minor ?? "")) return true;
  if (normalized.prerequisites !== (testCase.prerequisites ?? "")) return true;
  if (normalized.description !== testCase.description) return true;
  return false;
}

export function testCaseDraftToPatch(
  testCase: TestCase,
  draft: TestCaseEditDraft,
): Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">> {
  const normalized = normalizeTestCaseDraft(draft);
  const patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">> = {
    category: {
      major: normalized.major,
      ...(normalized.medium ? { medium: normalized.medium } : {}),
      ...(normalized.minor ? { minor: normalized.minor } : {}),
    },
    description: normalized.description,
    prerequisites: normalized.prerequisites || undefined,
  };

  if (normalized.bumpVersion) {
    const current = testCase.version ?? 1;
    patch.version = current + 1;
  }

  return patch;
}
