/** Persist-then-broadcast ordering shared by ProjectRoom and tests. */
export async function persistThenBroadcast(options: {
  duplicate: boolean;
  persisted: boolean;
  persist: () => Promise<void>;
  broadcast: () => void | Promise<void>;
}): Promise<void> {
  if (options.duplicate && options.persisted) return;
  await options.persist();
  await options.broadcast();
}
