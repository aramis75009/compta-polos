import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;

        const expectedEmail = (process.env.AUTH_EMAIL ?? "").trim().toLowerCase();
        const expectedHash = process.env.AUTH_PASSWORD ?? "";
        if (!expectedEmail || !expectedHash) return null;
        if (email !== expectedEmail) return null;

        const ok = await bcrypt.compare(password, expectedHash);
        if (!ok) return null;

        return { id: "owner", email: expectedEmail };
      },
    }),
  ],
});
