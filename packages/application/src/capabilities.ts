/** Phase ごとの機能差。UI 共通化時に props / slot の分岐に使う */
export interface WorkspaceCapabilities {
  realtime: boolean;
  offline: boolean;
  importResults: boolean;
  exportResults: boolean;
}

export const PHASE1_CAPABILITIES: WorkspaceCapabilities = {
  realtime: false,
  offline: true,
  importResults: true,
  exportResults: true,
};

export const PHASE2_CAPABILITIES: WorkspaceCapabilities = {
  realtime: true,
  offline: false,
  importResults: false,
  exportResults: false,
};
