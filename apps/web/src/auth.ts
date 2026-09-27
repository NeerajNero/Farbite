import NextAuth from "next-auth";
import type { UpsertUserBody, UpsertUserResponse } from "@farbite/shared";
import { authConfig } from "@/auth.config";
import { apiFetch } from "@/app/_libs/api/client";

// Auth.js v5, Google, JWT sessions, no DB adapter — the API owns users
// (PLAN.md §7.3). On sign-in we upsert the user in the API and keep its id
// and is_admin in the JWT. is_admin is recomputed by the API every sign-in.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.email) {
        const body: UpsertUserBody = {
          email: user.email,
          name: user.name ?? null,
          image: user.image ?? null,
        };
        const result = await apiFetch<UpsertUserResponse>("/v1/users/upsert", {
          method: "POST",
          body: JSON.stringify(body),
        });
        token.userId = result.id;
        token.isAdmin = result.is_admin;
      }
      return token;
    },
  },
});
