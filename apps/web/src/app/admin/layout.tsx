import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/admin/sign-out-button";

const NAV = [
  { href: "/admin/drops", label: "Drops" },
  { href: "/admin/restaurants", label: "Restaurants" },
  { href: "/admin/delivery-points", label: "Delivery points" },
  { href: "/admin/settings", label: "Settings" },
] as const;

// Defense in depth: proxy.ts already gates /admin/**; re-check here so a
// missing/misconfigured proxy never exposes the panel (the API is the real gate).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const session = await auth();
  const user = session?.user;

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-10">
        <h1 className="text-xl font-semibold">403 — Not an admin</h1>
        <p className="text-sm text-neutral-600">
          {user
            ? "This Google account is not on the admin list."
            : "You are not signed in."}
        </p>
        <div className="flex gap-4 text-sm">
          <Link
            href="/auth/signin?callbackUrl=/admin"
            className="text-blue-700 underline"
          >
            Sign in
          </Link>
          {user && <SignOutButton />}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-200 pb-3 text-sm">
        <span className="font-semibold">Admin</span>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-neutral-700 hover:text-neutral-900"
          >
            {item.label}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-3 text-neutral-500">
          <span className="truncate">{user.email}</span>
          <SignOutButton />
        </span>
      </nav>
      {children}
    </div>
  );
}
