import { WorkspaceController, type ProjectRepository } from "@qarows/application";
import { HttpProjectRepository } from "./http-project-repository";
import { WebSocketProjectChannel } from "./websocket-project-channel";

export function createPhase2WorkspaceController(
  repository: ProjectRepository = new HttpProjectRepository(),
): { controller: WorkspaceController; channel: WebSocketProjectChannel } {
  const channel = new WebSocketProjectChannel();
  const controller = new WorkspaceController({ repository, channel });
  return { controller, channel };
}
