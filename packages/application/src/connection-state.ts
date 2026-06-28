export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface ConnectionState {
  status: ConnectionStatus;
  /** サーバー側 revision（Phase2）。Phase1 は常に 0 */
  revision: number;
  /** 未 ACK の送信コマンド数（Phase2） */
  pendingCommands: number;
}

export const IDLE_CONNECTION: ConnectionState = {
  status: "idle",
  revision: 0,
  pendingCommands: 0,
};

export const LOCAL_CONNECTED: ConnectionState = {
  status: "connected",
  revision: 0,
  pendingCommands: 0,
};
