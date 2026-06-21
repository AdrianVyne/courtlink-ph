import { describe, expect, it } from "vitest";
import { PasswordHasher } from "./password-hasher.js";

describe("PasswordHasher", () => {
  it("stores passwords with Argon2id and verifies the original", async () => {
    const hasher = new PasswordHasher();
    const password = "a-long-player-password";

    const hash = await hasher.hash(password);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(hasher.verify(hash, password)).resolves.toBe(true);
    await expect(hasher.verify(hash, "incorrect-password")).resolves.toBe(false);
  });
});
