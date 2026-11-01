import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as PackageManifest;

describe("package.json", () => {
  it("pins every frontend dependency to an exact version", () => {
    const versions = { ...manifest.dependencies, ...manifest.devDependencies };

    const unpinned = Object.entries(versions).filter(
      ([, version]) => !/^\d+\.\d+\.\d+$/.test(version),
    );

    expect(unpinned).toEqual([]);
  });
});
