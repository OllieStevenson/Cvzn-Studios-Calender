"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken } from "@/lib/session";
import { isMfaEnabled, verifyTotp } from "@/lib/totp";

export async function loginAction(formData: FormData) {
  const password = formData.get("password") as string;
  const code = (formData.get("code") as string) ?? "";

  const passwordOk = password === process.env.ADMIN_PASSWORD;
  // If MFA is configured, the code must also be valid. If not configured,
  // the code is ignored (lets you deploy before enrolling without lockout).
  const mfaOk = !isMfaEnabled() || verifyTotp(code.trim());

  if (passwordOk && mfaOk) {
    const cookieStore = await cookies();
    cookieStore.set("dashboard_auth", createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    redirect("/dashboard");
  }

  redirect("/dashboard/login?error=1");
}
