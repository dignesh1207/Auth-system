// Shared TypeScript types for the auth system.
// These are separate from Zod-inferred types (in validations/) because they
// represent data shapes *after* DB reads, not input validation shapes.

export type UserRole = "USER" | "ADMIN";

// What we embed inside a JWT access token.
// Keep this minimal — it's readable by anyone who base64-decodes the token.
// NEVER include sensitive data (passwordHash, SSN, etc.).
export interface JWTPayload {
  sub: string;       // user ID (subject)
  email: string;
  role: UserRole;
  emailVerified: boolean;
}

// The safe user object returned to clients. Never includes passwordHash.
export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
}

// Standard API response envelope.
export type ApiResponse<T = undefined> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: Record<string, string[]> };
