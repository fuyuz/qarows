import { Badge } from "../ui/badge";
import { cn } from "../../lib/cn";

export function SyncStatusBadge({
  connected,
  revision,
}: {
  connected: boolean;
  revision?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Badge variant={connected ? "default" : "secondary"}>
        {connected ? "同期中" : "切断"}
      </Badge>
      {revision != null && (
        <span className={cn("text-muted-foreground", !connected && "text-destructive")}>
          rev {revision}
        </span>
      )}
    </div>
  );
}
