import crypto from "crypto";

// Creates a random token signed with ADMIN_PASSWORD.
// The cookie stores this token — not the password itself.
export function createSessionToken(): string {
  const token = crypto.randomBytes(32).toString("hex");
  const sig = crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD!)
    .update(token)
    .digest("hex");
  return `${token}.${sig}`;
}

// Returns true only if the token was signed by the current ADMIN_PASSWORD.
// Changing ADMIN_PASSWORD instantly invalidates all existing sessions.
export function verifySessionToken(value: string): boolean {
  const dot = value.lastIndexOf(".");
  if (dot === -1) return false;
  const token = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!token || !sig) return false;
  const expected = crypto
    .createHmac("sha256", process.env.ADMIN_PASSWORD!)
    .update(token)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
