// Token generation utilities.
// We use cryptographically-secure random bytes (not Math.random!) for tokens
// that gate security-sensitive actions like email verification and password reset.

import { randomBytes, createHash } from "crypto";

// Generate a URL-safe hex token (e.g. for email verification links).
// 32 bytes = 256 bits of entropy — infeasible to guess.
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

// Hash a token before storing it in the database.
// WHY: If an attacker dumps your DB, they get useless hashes, not live tokens.
// We use sha256 here (not bcrypt) because tokens are already high-entropy
// random strings — they don't need the slow work factor that bcrypt provides
// for low-entropy passwords.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Returns a Date object for N minutes from now.
export function expiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

// Returns a Date object for N hours from now.
export function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
