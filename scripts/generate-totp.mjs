// One-time MFA enrolment helper. Run locally:  node scripts/generate-totp.mjs
//
// It prints a QR code in your terminal to scan with an authenticator app
// (Google Authenticator / Authy / 1Password), plus the secret to paste into
// Vercel as the ADMIN_TOTP_SECRET environment variable.
//
// The secret is generated fresh on your machine and only printed here —
// it is never committed or sent anywhere.

import { authenticator } from "otplib";
import qrcode from "qrcode";

const secret = authenticator.generateSecret();
const account = "ollie@cvznstudios.co.uk";
const issuer = "CVZN Studios Dashboard";

const otpauth = authenticator.keyuri(account, issuer, secret);

console.log("\n=== CVZN Studios — Dashboard MFA enrolment ===\n");
console.log("1. Scan this QR code with your authenticator app:\n");

qrcode.toString(otpauth, { type: "terminal", small: true }, (err, qr) => {
  if (err) {
    console.error("Failed to render QR:", err);
  } else {
    console.log(qr);
  }

  console.log("   (Can't scan? Manually enter this key into the app:)");
  console.log(`   ${secret}\n`);

  console.log("2. Add this to Vercel → Project Settings → Environment Variables:\n");
  console.log(`   ADMIN_TOTP_SECRET=${secret}\n`);

  console.log("3. Redeploy. MFA is now required at /dashboard/login.\n");
  console.log("   Keep this secret safe. Anyone with it can generate your codes.\n");
});
