import { signInWithGoogle } from "@/app/_libs/auth/actions";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: PageProps<"/auth/signin">) {
  const params = await searchParams;
  const raw = params.callbackUrl;
  const callbackUrl = typeof raw === "string" ? raw : "/admin";

  return (
    <div className="mx-auto max-w-sm space-y-6 py-10">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-neutral-600">
          Admins sign in with the Google account on the allowlist.
        </p>
      </div>
      <form
        action={signInWithGoogle}
        className="rounded-lg border border-neutral-200 p-4"
      >
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <button
          type="submit"
          className="w-full rounded-md bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Continue with Google
        </button>
      </form>
    </div>
  );
}
