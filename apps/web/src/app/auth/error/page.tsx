import Link from "next/link";

export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  Configuration:
    "Sign-in is misconfigured on the server. Check the Auth.js env values.",
  AccessDenied: "This account is not allowed to sign in.",
  Verification: "The sign-in link is no longer valid.",
  Callback:
    "Sign-in could not be completed (the API may be waking up). Please try again.",
};

export default async function AuthErrorPage({
  searchParams,
}: PageProps<"/auth/error">) {
  const params = await searchParams;
  const code = typeof params.error === "string" ? params.error : "Default";
  const message = MESSAGES[code] ?? "Something went wrong while signing in.";

  return (
    <div className="mx-auto max-w-sm space-y-4 py-10">
      <h1 className="text-xl font-semibold">Sign-in failed</h1>
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        {message}
      </p>
      <Link href="/auth/signin" className="text-sm text-blue-700 underline">
        Try again
      </Link>
    </div>
  );
}
