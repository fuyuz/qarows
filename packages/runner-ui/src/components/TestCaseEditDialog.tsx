import type { SessionTestTargets, TestCase } from "@qarows/shared";
import { getTestCaseVersion } from "@qarows/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  TestCaseFormFields,
  isTestCaseDraftDirty,
  normalizeTestCaseDraft,
  testCaseDraftToPatch,
  testCaseToDraft,
  type TestCaseEditDraft,
} from "./TestCaseFormFields";
import { Button } from "@qarows/ui";
import { Badge } from "@qarows/ui";
import { Checkbox } from "@qarows/ui";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@qarows/ui";
import { Label } from "@qarows/ui";
import { cn } from "@qarows/ui";

export function TestCaseEditDialog({
  open,
  testCase,
  envTargets,
  busy = false,
  onSave,
  onClose,
}: {
  open: boolean;
  testCase: TestCase;
  envTargets: SessionTestTargets;
  busy?: boolean;
  onSave: (
    patch: Partial<Pick<TestCase, "category" | "prerequisites" | "description" | "version">>,
  ) => void | Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<TestCaseEditDraft>(() => testCaseToDraft(testCase));
  const [majorError, setMajorError] = useState(false);
  const [descriptionError, setDescriptionError] = useState(false);
  const wasOpenRef = useRef(false);

  const isDirty = useMemo(() => isTestCaseDraftDirty(testCase, draft), [draft, testCase]);
  const currentVersion = getTestCaseVersion(testCase);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(testCaseToDraft(testCase));
      setMajorError(false);
      setDescriptionError(false);
    }
    wasOpenRef.current = open;
  }, [open, testCase]);

  const handleSave = async () => {
    const normalized = normalizeTestCaseDraft(draft);
    let hasError = false;
    if (!normalized.major) {
      setMajorError(true);
      hasError = true;
    }
    if (!normalized.description) {
      setDescriptionError(true);
      hasError = true;
    }
    if (hasError) return;

    setMajorError(false);
    setDescriptionError(false);
    const patch = testCaseDraftToPatch(testCase, normalized);
    await onSave(patch);
    const updated: TestCase = {
      ...testCase,
      ...patch,
      category: patch.category ?? testCase.category,
    };
    setDraft(testCaseToDraft(updated));
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[min(90vh,720px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <DialogTitle>テスト項目を編集</DialogTitle>
            <Badge variant="secondary" className="bg-primary/10 font-bold text-primary">
              {testCase.id}
            </Badge>
            {currentVersion > 1 && (
              <Badge variant="outline" className="text-[0.65rem] font-bold">
                v{currentVersion}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <TestCaseFormFields
            idPrefix={`test-case-edit-${testCase.id}`}
            envTargets={envTargets}
            draft={draft}
            setDraft={setDraft}
            majorError={majorError}
            setMajorError={setMajorError}
            descriptionError={descriptionError}
            setDescriptionError={setDescriptionError}
          />

          <div className="mt-4 flex items-start gap-2.5 rounded-lg border p-3">
            <Checkbox
              id={`test-case-edit-${testCase.id}-bump-version`}
              checked={draft.bumpVersion}
              onCheckedChange={(value) =>
                setDraft((prev) => ({ ...prev, bumpVersion: value === true }))
              }
            />
            <div className="grid gap-1">
              <Label
                htmlFor={`test-case-edit-${testCase.id}-bump-version`}
                className="cursor-pointer font-medium"
              >
                バージョンを更新
              </Label>
              <p className="text-xs text-muted-foreground">
                {draft.bumpVersion ? (
                  <>
                    保存時に v{currentVersion} → v{currentVersion + 1} に更新します。既存のテスト結果は未実施扱いになり、再テスト対象になります。
                  </>
                ) : (
                  <>チェックすると、保存時にテスト定義の version を 1 つ上げます（現在 v{currentVersion}）。</>
                )}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              閉じる
            </Button>
            <Button
              type="button"
              disabled={busy || !isDirty}
              className={cn(busy && "opacity-70")}
              onClick={() => void handleSave()}
            >
              保存
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
