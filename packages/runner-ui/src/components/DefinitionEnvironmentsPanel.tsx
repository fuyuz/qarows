import { useState } from "react";
import type { Environment } from "@qarows/shared";
import { useTranslation } from "@qarows/ui";
import { Button, Input, Label, cn } from "@qarows/ui";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";

export function DefinitionEnvironmentsPanel({
  environments,
  onUpdate,
  onAdd,
  onRemove,
  className,
}: {
  environments: Environment[];
  onUpdate: (envId: string, patch: Partial<Environment>) => void;
  onAdd: (env: Environment) => void;
  onRemove: (envId: string) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [idError, setIdError] = useState<string | null>(null);

  const handleAdd = () => {
    const id = newId.trim();
    if (!id) {
      setIdError(t("definition.errIdRequired"));
      return;
    }
    if (environments.some((env) => env.id === id)) {
      setIdError(t("definition.errIdDuplicate", { id }));
      return;
    }
    onAdd({ id, name: newName.trim() || id });
    setNewId("");
    setNewName("");
    setIdError(null);
  };

  return (
    <section className={cn("rounded-lg border border-border/80 bg-card/40", className)}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <span>{t("definition.envTitle")}</span>
        <span className="text-xs font-normal text-muted-foreground">{t("common.count", { n: environments.length })}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border/60 px-4 py-3">
          {environments.map((env) => (
            <div key={env.id} className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-[8rem] flex-1 gap-1">
                <Label className="text-xs text-muted-foreground">ID</Label>
                <Input value={env.id} disabled className="h-8 bg-muted/40" />
              </div>
              <div className="grid min-w-[10rem] flex-[2] gap-1">
                <Label className="text-xs text-muted-foreground">{t("definition.displayName")}</Label>
                <Input
                  value={env.name}
                  className="h-8"
                  onChange={(e) => onUpdate(env.id, { name: e.target.value })}
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8 shrink-0 text-muted-foreground"
                disabled={environments.length <= 1}
                onClick={() => {
                  if (window.confirm(t("definition.deleteEnvConfirm", { name: env.name }))) {
                    onRemove(env.id);
                  }
                }}
                aria-label={t("definition.deleteEnvAria", { name: env.name })}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <div className="space-y-1 border-t border-dashed border-border/60 pt-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="grid min-w-[8rem] flex-1 gap-1">
                <Label className="text-xs text-muted-foreground" htmlFor="definition-env-new-id">
                  {t("definition.newId")}
                </Label>
                <Input
                  id="definition-env-new-id"
                  value={newId}
                  className={cn("h-8", idError && "animate-ui-shake")}
                  placeholder="chrome-desktop"
                  aria-invalid={idError != null}
                  onChange={(e) => {
                    setIdError(null);
                    setNewId(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
              </div>
              <div className="grid min-w-[10rem] flex-[2] gap-1">
                <Label className="text-xs text-muted-foreground">{t("definition.displayName")}</Label>
                <Input
                  value={newName}
                  className="h-8"
                  placeholder="Chrome (Desktop)"
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8"
                onClick={handleAdd}
                disabled={!newId.trim()}
              >
                <Plus className="mr-1 size-3.5" />
                {t("common.add")}
              </Button>
            </div>
            {idError ? <p className="text-sm text-destructive">{idError}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
