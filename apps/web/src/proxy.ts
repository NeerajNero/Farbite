import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Admin gate (PLAN.md §7.3): optimistic cookie/JWT check only. The API's
// AdminGuard is the source of truth; the admin layout re-checks too.
const { auth } = NextAuth(authConfig);

const FORBIDDEN_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>403 — Not an admin</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:system-ui,sans-serif;margin:0;padding:3rem 1rem;color:#171717}
main{max-width:28rem;margin:0 auto}a{color:#1d4ed8}</style></head>
<body><main><h1>403 — Not an admin</h1>
<p>This Google account is signed in but is not on the admin list.</p>
<p><a href="/api/auth/signout">Sign out</a> · <a href="/">Home</a></p></main></body></html>`;

export default auth((req) => {
  const session = req.auth;
  if (!session?.user) {
    const signIn = new URL("/auth/signin", req.nextUrl);
    signIn.searchParams.set(
      "callbackUrl",
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return NextResponse.redirect(signIn);
  }
  if (!session.user.isAdmin) {
    return new NextResponse(FORBIDDEN_HTML, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
