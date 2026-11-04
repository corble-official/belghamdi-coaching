/**
 * Shared email validation for the provisioning pipeline (Task 2.5).
 * Tiny dependency-free module so invite.ts, provision-client.ts and the
 * demo seam can share it without import cycles.
 */

/** A "usable" email is trimmed, contains an @, and has no whitespace. */
export function usableEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed.length < 3 || trimmed.length > 254) return null;
  if (!trimmed.includes("@")) return null;
  if (/\s/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}
