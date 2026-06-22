import { access } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "./manifest";

describe("web app manifest", () => {
  it("only references icons shipped in public", async () => {
    const icons = manifest().icons ?? [];

    await expect(
      Promise.all(icons.map((icon) => access(join(process.cwd(), "public", icon.src)))),
    ).resolves.toBeDefined();
  });
});
