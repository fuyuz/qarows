export {
  inheritsRunnerQueryFromLocation,
  projectPath,
  resolveProjectId,
  type ProjectPage,
} from "@qarows/runner-ui";

/** Query value for the new-project import panel on /projects. */
export const NEW_PROJECT_SELECTION = "_new";

export function projectsHubPath(projectSelection?: string | null): string {
  if (!projectSelection) return "/projects";
  return `/projects?project=${encodeURIComponent(projectSelection)}`;
}
