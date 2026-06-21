import { argon2id, hash, verify } from "argon2";

export class PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  verify(passwordHash: string, candidate: string): Promise<boolean> {
    return verify(passwordHash, candidate);
  }
}
