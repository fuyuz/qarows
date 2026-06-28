import { Badge } from "../ui/badge";
import { cn } from "../../lib/cn";

type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

function connectionStatusLabel(status: ConnectionStatus, connected: boolean): string {
  switch (status) {
    case "connected":
      return "同期中";
    case "reconnecting":
      return "再接続中";
    case "connecting":
      return "接続中";
    default:
      return connected ? "同期中" : "切断";
  }
}

export function SyncStatusBadge({
  connected,
  connectionStatus,
  pendingCommands = 0,
  revision,
}: {
  connected: boolean;
  connectionStatus?: ConnectionStatus;
  pendingCommands?: number;
  revision?: number;
}) {
  const status = connectionStatus ?? (connected ? "connected" : "disconnected");
  const online = status === "connected";

  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={online ? "default" : "secondary"}>
        {connectionStatusLabel(status, connected)}
      </Badge>
      {pendingCommands > 0 && (
        <Badge variant="outline">
          {online ? "保存中" : `未送信 ${pendingCommands} 件`}
        </Badge>
      )}
      {revision != null && (
        <span className={cn("text-muted-foreground", !online && "text-destructive")}>
          rev {revision}
        </span>
      )}
    </div>
  );
}
