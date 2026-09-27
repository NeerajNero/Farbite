"use server";

import { signIn, signOut } from "@/auth";

// Only same-site relative paths are allowed as post-login destinations.
function safeRedirect(target: string | undefined): string {
  if (target && target.startsWith("/") && !target.startsWith("//"))
    return target;
  return "/admin";
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const callbackUrl = formData.get("callbackUrl");
  await signIn("google", {
    redirectTo: safeRedirect(
      typeof callbackUrl === "string" ? callbackUrl : undefined,
    ),
  });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
