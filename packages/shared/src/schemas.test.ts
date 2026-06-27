import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const schemaDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../schemas");

describe("JSON schemas", () => {
  for (const name of ["results.schema.json", "tests.schema.json"] as const) {
    it(`${name} is valid JSON Schema document`, () => {
      const schema = JSON.parse(readFileSync(path.join(schemaDir, name), "utf8")) as {
        $schema?: string;
        type?: string;
      };
      expect(schema.$schema).toContain("json-schema.org");
      expect(schema.type).toBe("object");
    });
  }
});
