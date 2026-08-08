import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // `/` sert la landing publique (elle redirige elle-même vers /dashboard
      // quand une session existe). `/legal/*` était protégé alors que CLAUDE.md
      // et AppShell le traitent comme public — et le pied de page de la landing
      // pointe dessus.
      const isPublic =
        pathname === "/" ||
        ["/login", "/signup", "/reset-password"].includes(pathname) ||
        pathname.startsWith("/legal");

      if (isPublic) return true;
      return isLoggedIn;
    },

    // `user` n'est renseigné qu'au moment du login : c'est la seule fenêtre où
    // l'on peut figer l'identité dans le JWT. Aux appels suivants, seul `token`
    // est disponible — d'où la garde.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.prenom = user.prenom ?? null;
      }
      return token;
    },

    // Sans ce callback, Auth.js ne remonte que name/email/image : `user.id`
    // n'existait pas côté application, et tout le code devait passer par
    // l'email. C'est ce qui rend le cloisonnement par userId possible.
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.prenom = token.prenom;
      }
      return session;
    },
  },
};
