import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      /** API users.id (from POST /v1/users/upsert). */
      id: string;
      isAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isAdmin?: boolean;
  }
}
