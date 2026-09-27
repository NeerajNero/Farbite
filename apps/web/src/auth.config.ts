import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe Auth.js config (no API calls, no env import) — shared by the
// proxy (JWT check only) and the full NextAuth instance in auth.ts.
// Auth.js reads AUTH_SECRET / AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env.
export const authConfig = {
  providers: [Google],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin", error: "/auth/error" },
  callbacks: {
    session({ session, token }) {
      if (typeof token.userId === "string") session.user.id = token.userId;
      session.user.isAdmin = token.isAdmin === true;
      return session;
    },
  },
} satisfies NextAuthConfig;
