import { authenticator } from "otplib";

// True if MFA is configured (secret present in env).
export function isMfaEnabled(): boolean {
  return !!process.env.ADMIN_TOTP_SECRET;
}

// Verifies a 6-digit TOTP code against ADMIN_TOTP_SECRET.
// Allows a ±1 time-step window to tolerate minor clock drift.
export function verifyTotp(code: string): boolean {
  const secret = process.env.ADMIN_TOTP_SECRET;
  if (!secret) return false;
  if (!/^\d{6}$/.test(code)) return false;
  try {
    authenticator.options = { window: 1 };
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
