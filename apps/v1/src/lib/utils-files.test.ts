import { describe, expect, it } from "vitest";
import { appendUniqueFiles, fileKey } from "@/lib/utils";

describe("appendUniqueFiles", () => {
  it("deduplicates by fileKey", () => {
    const first = new File(["a"], "results.json", { type: "application/json" });
    const duplicate = new File(["b"], "results.json", {
      type: "application/json",
      lastModified: first.lastModified,
    });
    Object.defineProperty(duplicate, "size", { value: first.size });

    const merged = appendUniqueFiles([first], [duplicate, first]);
    expect(merged).toHaveLength(1);
    expect(fileKey(merged[0]!)).toBe(fileKey(first));
  });
});
