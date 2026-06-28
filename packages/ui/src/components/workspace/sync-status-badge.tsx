import { useEffect, useRef, useState } from "react";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/cn";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export type WorkspaceSyncStatus = {
  connected: boolean;
  connectionStatus?: ConnectionStatus;
  pendingCommands?: number;
  revision?: number;
  /** 増えるたびに接続ドットを短く明るくする（Team 版の受信・保存完了） */
  syncPulseKey?: number;
};

export function resolveConnectionStatus(
  connected: boolean,
  connectionStatus?: ConnectionStatus,
): ConnectionStatus {
  return connectionStatus ?? (connected ? "connected" : "disconnected");
}

export function connectionStatusLabel(status: ConnectionStatus, connected: boolean): string {
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

function isHealthyConnection(status: ConnectionStatus, connected: boolean): boolean {
  return connected && status === "connected";
}

function connectionStatusTooltip(
  status: ConnectionStatus,
  connected: boolean,
  pendingCommands: number,
): string {
  const label = connectionStatusLabel(status, connected);
  if (isHealthyConnection(status, connected)) {
    if (pendingCommands > 0) {
      return `${label} — 変更を保存しています`;
    }
    return `${label} — サーバーとリアルタイム同期しています`;
  }
  if (status === "connecting") {
    return `${label} — サーバーに接続しています`;
  }
  if (status === "reconnecting") {
    return `${label} — サーバーとの接続を再試行しています`;
  }
  if (status === "disconnected" || !connected) {
    if (pendingCommands > 0) {
      return `${label} — 未送信の変更が ${pendingCommands} 件あります`;
    }
    return `${label} — サーバーとの接続がありません`;
  }
  return label;
}

export function shouldShowConnectionDot(_status: ConnectionStatus, _connected: boolean): boolean {
  return true;
}

function connectionDotClassName(status: ConnectionStatus, connected: boolean): string {
  if (isHealthyConnection(status, connected)) return "bg-green-500";
  if (status === "connecting") return "bg-blue-500";
  if (status === "reconnecting") return "bg-amber-500";
  if (status === "disconnected" || !connected) return "bg-destructive";
  return "bg-muted-foreground";
}

export function SyncConnectionIndicator({
  connected,
  connectionStatus,
  pendingCommands = 0,
  syncPulseKey = 0,
}: Pick<WorkspaceSyncStatus, "connected" | "connectionStatus" | "pendingCommands" | "syncPulseKey">) {
  const status = resolveConnectionStatus(connected, connectionStatus);
  const tooltip = connectionStatusTooltip(status, connected, pendingCommands);
  const healthy = isHealthyConnection(status, connected);
  const [flashing, setFlashing] = useState(false);
  const lastPulseKeyRef = useRef(syncPulseKey);

  useEffect(() => {
    if (!healthy || syncPulseKey === 0 || syncPulseKey === lastPulseKeyRef.current) return;
    lastPulseKeyRef.current = syncPulseKey;
    setFlashing(true);
    const timer = setTimeout(() => setFlashing(false), 100);
    return () => clearTimeout(timer);
  }, [healthy, syncPulseKey]);

  return (
    <div className="group relative flex items-center" tabIndex={0}>
      <span
        className={cn(
          "size-2.5 shrink-0 rounded-full ring-2 ring-background transition-colors duration-100 ease-out motion-reduce:transition-none",
          healthy && flashing ? "bg-green-300" : connectionDotClassName(status, connected),
          (status === "connecting" || status === "reconnecting") && !flashing && "motion-safe:animate-pulse",
        )}
        aria-label={tooltip}
        aria-describedby="sync-connection-tooltip"
      />
      <div
        id="sync-connection-tooltip"
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+0.5rem)] right-0 z-50 hidden min-w-44 max-w-56 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md group-focus-within:block group-hover:block"
      >
        {tooltip}
      </div>
    </div>
  );
}

export function SyncStatusMenuSection({
  connected,
  connectionStatus,
  pendingCommands = 0,
  revision,
}: WorkspaceSyncStatus) {
  const status = resolveConnectionStatus(connected, connectionStatus);
  const online = status === "connected";

  return (
    <div className="px-2 py-1.5">
      <p className="mb-1.5 text-xs uppercase tracking-wide text-muted-foreground">同期</p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
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
    </div>
  );
}

/** @deprecated WorkspaceAppNav の syncStatus を使ってください */
export function SyncStatusBadge({
  connected,
  connectionStatus,
  pendingCommands = 0,
  revision,
}: WorkspaceSyncStatus) {
  const status = resolveConnectionStatus(connected, connectionStatus);
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
