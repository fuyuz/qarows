import {
  LocalProjectChannel,
  WorkspaceController,
  type ProjectRepository,
} from "@qarows/application";
import { IndexedDbProjectRepository } from "./indexed-db-project-repository";

export function createLocalWorkspaceController(
  repository: ProjectRepository = new IndexedDbProjectRepository(),
): WorkspaceController {
  const channel = new LocalProjectChannel({
    onPersist: async (snapshot) => {
      await repository.saveSnapshot(snapshot);
    },
  });
  return new WorkspaceController({ repository, channel });
}
