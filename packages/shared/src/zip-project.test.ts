import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  packProjectArchive,
  ProjectArchiveError,
  projectArchiveFilename,
  unpackProjectArchive,
} from "./zip-project";

const sampleYaml = `
project:
  name: Zip QA
  id: zip-qa
environments:
  - id: chrome
    name: Chrome
testCases:
  - id: TC-001
    category:
      major: Auth
    description: Login
`;

const sampleResults = JSON.stringify(
  {
    projectId: "zip-qa",
    results: [],
    bugs: [],
  },
  null,
  2,
);

describe("project archive", () => {
  it("packs and unpacks official export names", () => {
    const archive = packProjectArchive({ testsYaml: sampleYaml, resultsJson: sampleResults });
    const files = unpackProjectArchive(archive);

    expect(files).toHaveLength(2);
    expect(files.find((file) => file.kind === "tests")?.name).toBe("tests.yml");
    expect(files.find((file) => file.kind === "results")?.name).toBe("results.json");
    expect(files.find((file) => file.kind === "tests")?.content).toContain("Zip QA");
    expect(files.find((file) => file.kind === "results")?.content).toContain('"projectId": "zip-qa"');
  });

  it("accepts alternate entry names by extension", () => {
    const archive = zipSync({
      "project/my-tests.yml": strToU8(sampleYaml),
      "runs/run-a.json": strToU8(sampleResults),
    });
    const files = unpackProjectArchive(archive);

    expect(files).toHaveLength(2);
    expect(files.find((file) => file.kind === "tests")?.name).toBe("my-tests.yml");
    expect(files.find((file) => file.kind === "results")?.name).toBe("run-a.json");
  });

  it("builds archive filename from project id", () => {
    expect(projectArchiveFilename("qarows")).toBe("qarows.zip");
  });

  it("rejects unsafe archive paths", () => {
    const archive = zipSync({
      "../tests.yml": strToU8(sampleYaml),
    });
    expect(() => unpackProjectArchive(archive)).toThrow(ProjectArchiveError);
  });

  it("rejects invalid zip data", () => {
    expect(() => unpackProjectArchive(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toThrow(
      ProjectArchiveError,
    );
  });
});
