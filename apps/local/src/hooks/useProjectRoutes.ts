import { useProjectRoutesFor } from "@qarows/runner-ui";
import { useApp } from "@/context/AppContext";

/** SessionPage / RunPage は RunnerWorkspace の provider 外なので、AppContext から渡す */
export function useProjectRoutes() {
  const { definition } = useApp();
  return useProjectRoutesFor(definition);
}
