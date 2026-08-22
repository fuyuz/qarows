import { describe, expect, it } from "vitest";
import type { Bug, ResultsFile } from "@qarows/shared";
import { fetchProjectArchiveAttachments } from "./export-archive";

const KEYS = Array.from(
  { length: 12 },
  (_, index) => `0189bd6c-1f2e-4a3b-8c4d-5e6f7a8b9c${String(index).padStart(2, "0")}`,
);

function bugWith(id: string, keys: string[]): Bug {
  return {
    id,
    title: id,
    severity: "medium",
    status: "open",
    attachments: keys.map((key) => ({ key, name: `${key}.png`, size: 1, mimeType: "image/png" })),
  };
}

function resultsWith(bugs: Bug[]): ResultsFile {
  return {
    version: 1,
    projectId: "test",
    updatedAt: "2026-06-28T12:00:00.000Z",
    results: {},
    memos: {},
    bugs,
  };
}

/** fetch を差し替え、同時に走った本数と要求 URL を記録する */
function withTrackedFetch(
  handler: (url: string) => { ok: boolean; body?: string },
): {
  restore: () => void;
  urls: string[];
  completionOrder: string[];
  peak: () => number;
  release: () => void;
} {
  const original = globalThis.fetch;
  const urls: string[] = [];
  const completionOrder: string[] = [];
  let inFlight = 0;
  let peak = 0;
  const pending: Array<() => void> = [];

  globalThis.fetch = (async (input: string) => {
    urls.push(String(input));
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise<void>((resolve) => pending.push(resolve));
    inFlight -= 1;
    completionOrder.push(String(input).split("/").pop()!);
    const result = handler(String(input));
    return {
      ok: result.ok,
      async arrayBuffer() {
        return new TextEncoder().encode(result.body ?? "").buffer;
      },
    } as unknown as Response;
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = original;
    },
    urls,
    completionOrder,
    peak: () => peak,
    /** 逆順に解放する。完了順とインデックス順を意図的にずらす */
    release: () => {
      while (pending.length > 0) pending.pop()?.();
    },
  };
}

describe("fetchProjectArchiveAttachments", () => {
  it("fetches in parallel but caps how many are in flight", async () => {
    const tracked = withTrackedFetch(() => ({ ok: true, body: "x" }));
    try {
      const promise = fetchProjectArchiveAttachments(
        "test",
        resultsWith([bugWith("BUG-1", KEYS)]),
      );
      // 最初の解放前に走っている本数が上限
      await Promise.resolve();
      const peakBeforeRelease = tracked.peak();
      const drain = setInterval(() => tracked.release(), 0);
      const attachments = await promise;
      clearInterval(drain);

      expect(peakBeforeRelease).toBe(6);
      expect(tracked.peak()).toBe(6);
      expect(attachments).toHaveLength(KEYS.length);
      // 完了順（逆順に解放している）ではなく元の順序で並ぶこと
      expect(tracked.completionOrder).not.toEqual(KEYS);
      expect(attachments.map((entry) => entry.key)).toEqual(KEYS);
    } finally {
      tracked.restore();
    }
  });

  it("fetches a shared attachment only once", async () => {
    const tracked = withTrackedFetch(() => ({ ok: true, body: "x" }));
    try {
      const shared = KEYS.slice(0, 2);
      const promise = fetchProjectArchiveAttachments(
        "test",
        resultsWith([bugWith("BUG-1", shared), bugWith("BUG-2", shared)]),
      );
      const drain = setInterval(() => tracked.release(), 0);
      const attachments = await promise;
      clearInterval(drain);

      expect(tracked.urls).toHaveLength(2);
      expect(attachments.map((entry) => entry.key)).toEqual(shared);
    } finally {
      tracked.restore();
    }
  });

  it("skips attachments the server no longer has", async () => {
    const tracked = withTrackedFetch((url) => ({ ok: !url.endsWith(KEYS[0]!) }));
    try {
      const promise = fetchProjectArchiveAttachments(
        "test",
        resultsWith([bugWith("BUG-1", KEYS.slice(0, 3))]),
      );
      const drain = setInterval(() => tracked.release(), 0);
      const attachments = await promise;
      clearInterval(drain);

      expect(attachments.map((entry) => entry.key)).toEqual(KEYS.slice(1, 3));
    } finally {
      tracked.restore();
    }
  });
});
