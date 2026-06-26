import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublic = ["/login"].includes(nextUrl.pathname);
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
};
