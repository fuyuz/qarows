/** Persist-then-broadcast ordering shared by ProjectRoom and tests. */
export async function persistThenBroadcast(options: {
  duplicate: boolean;
  persist: () => Promise<void>;
  broadcast: () => void | Promise<void>;
}): Promise<void> {
  if (options.duplicate) return;
  await options.persist();
  await options.broadcast();
}
