export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface ConnectionState {
  status: ConnectionStatus;
  /** サーバー側 revision（Team 版）。Local 版は常に 0 */
  revision: number;
  /** 未 ACK の送信コマンド数（Team 版） */
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
