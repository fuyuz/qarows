import { useCallback } from "react";
import { parseAsString } from "nuqs";
import { useQueryStates } from "nuqs";

const projectsQueryParsers = {
  project: parseAsString,
};

export function useProjectsQueryState() {
  const [query, setQuery] = useQueryStates(projectsQueryParsers, { history: "replace" });

  const projectId = query.project;

  const setProjectId = useCallback(
    (nextProjectId: string | null) => {
      void setQuery({ project: nextProjectId });
    },
    [setQuery],
  );

  return {
    projectId,
    setProjectId,
  };
}
