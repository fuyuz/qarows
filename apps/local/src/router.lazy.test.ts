import { describe, expect, it } from "vitest";
import { lazyPageModules } from "@/router";

describe("lazy page modules", () => {
  it("resolves all route chunks", async () => {
    const entries = await Promise.all(
      Object.entries(lazyPageModules).map(async ([name, loader]) => {
        const mod = await loader();
        return [name, mod] as const;
      }),
    );

    for (const [name, mod] of entries) {
      const exportName = name as keyof typeof mod;
      expect(mod[exportName], `${name} export`).toBeTypeOf("function");
    }
  });
});
