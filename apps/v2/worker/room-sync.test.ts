import { describe, expect, it } from "vitest";
import { persistThenBroadcast } from "./room-sync";

describe("persistThenBroadcast", () => {
  it("persists before broadcasting", async () => {
    const steps: string[] = [];
    await persistThenBroadcast({
      duplicate: false,
      persist: async () => {
        steps.push("persist");
      },
      broadcast: async () => {
        steps.push("broadcast");
      },
    });
    expect(steps).toEqual(["persist", "broadcast"]);
  });

  it("skips persist and broadcast for duplicate commands", async () => {
    const steps: string[] = [];
    await persistThenBroadcast({
      duplicate: true,
      persist: async () => {
        steps.push("persist");
      },
      broadcast: async () => {
        steps.push("broadcast");
      },
    });
    expect(steps).toEqual([]);
  });

  it("does not broadcast when persist fails", async () => {
    const steps: string[] = [];
    await expect(
      persistThenBroadcast({
        duplicate: false,
        persist: async () => {
          steps.push("persist");
          throw new Error("D1 unavailable");
        },
        broadcast: async () => {
          steps.push("broadcast");
        },
      }),
    ).rejects.toThrow("D1 unavailable");
    expect(steps).toEqual(["persist"]);
  });
});
