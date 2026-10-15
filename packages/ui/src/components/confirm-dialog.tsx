import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "../i18n/context";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export interface ConfirmOptions {
  /** 本文（問いかけ） */
  message: string;
  title?: string;
  confirmLabel?: string;
  /** 削除・破棄など取り消せない操作なら true（赤いボタン） */
  destructive?: boolean;
}

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * window.confirm の代わりの確認ダイアログ。プロジェクト削除などの既存ダイアログと見た目を揃える。
 * アプリのルートに 1 つ置き、useConfirm() で呼ぶ
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  // 閉じるアニメーション中も文言・ボタンの色が変わらないよう、最後の内容を残しておく
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolveRef.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={(next) => !next && settle(false)}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{options?.title ?? t("common.confirmTitle")}</DialogTitle>
            <DialogDescription>{options?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => settle(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant={options?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
              {options?.confirmLabel ?? t("common.ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/** Provider の外（テストなど）では従来どおりブラウザの確認にフォールバックする。参照を固定して effect の再実行を防ぐ */
const nativeConfirm: Confirm = (options) => Promise.resolve(window.confirm(options.message));

export function useConfirm(): Confirm {
  return useContext(ConfirmContext) ?? nativeConfirm;
}
