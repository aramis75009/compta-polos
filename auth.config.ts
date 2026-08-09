import { NextResponse } from "next/server";
import type { NextAuthConfig } from "next-auth";
import {
  HOTE_APP,
  HOTES_SEPARES,
  estRouteVitrine,
  origineDe,
} from "@/lib/hosts";

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { nextUrl } = request;
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // ── Aiguillage par domaine ──
      //
      // Sans les deux variables d'hôte, ce bloc est inerte : tout continue
      // d'être servi sur un seul domaine. Une fois configuré, la vitrine ne
      // sert que la landing et les pages légales, et tout le reste — y compris
      // /login et /signup, qui posent le cookie de session — bascule sur
      // l'hôte de l'application.
      const hote = request.headers.get("host")?.toLowerCase().split(":")[0];
      if (HOTES_SEPARES && hote) {
        if (hote !== HOTE_APP && !estRouteVitrine(pathname)) {
          return NextResponse.redirect(
            new URL(`${pathname}${nextUrl.search}`, `https://${HOTE_APP}`),
          );
        }
        // Sur l'hôte de l'app, la racine n'a rien à montrer : la vitrine vit
        // ailleurs.
        //
        // La base est reconstruite depuis l'hôte REÇU, pas depuis `nextUrl` :
        // Auth.js aligne `nextUrl` sur `NEXTAUTH_URL`, si bien qu'une variable
        // restée sur l'ancien domaine renvoyait l'utilisateur s'y connecter —
        // et le cookie de session se posait sur le mauvais hôte.
        if (hote === HOTE_APP && pathname === "/") {
          return NextResponse.redirect(
            new URL(isLoggedIn ? "/dashboard" : "/login", `https://${hote}`),
          );
        }
      }

      // `/` sert la landing publique (elle redirige elle-même vers /dashboard
      // quand une session existe). `/legal/*` était protégé alors que CLAUDE.md
      // et AppShell le traitent comme public — et le pied de page de la landing
      // pointe dessus.
      const isPublic =
        pathname === "/" ||
        ["/login", "/signup", "/reset-password"].includes(pathname) ||
        pathname.startsWith("/legal");

      // Redirection vers la connexion faite ICI, et pas laissée à NextAuth.
      //
      // Laissée à NextAuth, elle est construite depuis `NEXTAUTH_URL` : un
      // changement de domaine renvoyait l'utilisateur se connecter sur
      // l'ancienne adresse, avec un `callbackUrl` qui l'y ramenait — et la
      // session se posait donc sur un hôte qu'il ne visitait pas. L'origine
      // réellement servie est dans la requête ; c'est la seule source fiable.
      if (!isPublic && !isLoggedIn) {
        const base = origineDe(request);
        const login = new URL("/login", base);
        login.searchParams.set(
          "callbackUrl",
          new URL(`${pathname}${nextUrl.search}`, base).toString(),
        );
        return NextResponse.redirect(login);
      }

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
