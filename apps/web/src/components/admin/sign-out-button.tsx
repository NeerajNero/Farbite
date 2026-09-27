import { signOutAction } from "@/app/_libs/auth/actions";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="text-sm text-neutral-600 underline hover:text-neutral-900"
      >
        Sign out
      </button>
    </form>
  );
}
