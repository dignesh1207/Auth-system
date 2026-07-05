// WHY bcrypt? It's intentionally slow (configurable "cost factor") and adds
// a random salt per hash — so identical passwords get different hashes, and
// brute-forcing a stolen database is computationally expensive.
//
// Cost factor 12 ≈ 250ms per hash on modern hardware. That's fine for login
// (users don't notice) but brutal for attackers (4 attempts/sec vs millions).
// Increase to 13-14 in production if your server can absorb the latency.

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// Returns true if the plain password matches the stored hash.
// bcrypt.compare handles timing-safe comparison internally.
export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
