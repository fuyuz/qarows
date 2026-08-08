import { bugSeverityLabels, bugStatusLabels } from "@qarows/shared";
import { useTranslation } from "@qarows/ui";
import { useMemo } from "react";

export function useBugLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => ({
      statusLabels: bugStatusLabels(t),
      severityLabels: bugSeverityLabels(t),
    }),
    [t],
  );
}
