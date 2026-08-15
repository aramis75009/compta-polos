import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/apiAuth";
import { chiffrer, chiffrementDisponible } from "@/lib/crypto";
import { HOTE_APP, origineDe } from "@/lib/hosts";
import { credentialsApp, demanderRequestToken, urlAutorisation } from "@/lib/trelloOAuth";
import { origineAutorisee, retourAvecCode, urlCallback } from "@/lib/trelloCallback";
import type { CodeErreurTrello } from "@/lib/trelloErreurs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Durée de vie du jeton de requête. Au-delà, le retour de Trello est refusé. */
const VALIDITE_MINUTES = 10;

// GET /api/trello/connect — démarre l'autorisation.
//
// Route de NAVIGATION, pas d'API : elle répond par une redirection 302, parce
// que le navigateur doit atterrir sur l'écran d'autorisation de Trello. Les
// échecs repartent eux aussi en redirection, avec un code — un JSON
// s'afficherait tel quel dans la barre d'adresse, ce qui n'est un message pour
// personne.
export async function GET(req: NextRequest) {
  const origine = origineDe(req);
  const depuis =
    req.nextUrl.searchParams.get("depuis") === "demarrage" ? "/demarrage" : "/compte";
  const echec = (code: CodeErreurTrello) =>
    NextResponse.redirect(retourAvecCode(origine, depuis, code));

  // Route de navigation : une session absente renvoie vers /login, pas un JSON
  // 401 que le navigateur afficherait tel quel. Le `matcher` du middleware
  // exclut `api`, donc rien d'autre ne protège cette route.
  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(`${origine.replace(/\/$/, "")}/login`);

  if (!origineAutorisee(origine, HOTE_APP)) {
    console.warn("[trello] connexion refusée : origine non autorisée");
    return echec("callback-invalide");
  }
  if (!credentialsApp() || !chiffrementDisponible()) return echec("non-configure");

  try {
    const requete = await demanderRequestToken(urlCallback(origine));

    // Le jeton de requête est stocké LIÉ AU userId : c'est la protection CSRF.
    // Au retour, on refuse tout oauth_token qui n'est pas celui de la session.
    const ephemere = {
      trelloOauthRequestToken: requete.token,
      trelloOauthRequestSecret: chiffrer(requete.secret),
      trelloOauthExpire: new Date(Date.now() + VALIDITE_MINUTES * 60_000),
    };
    await prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...ephemere },
      update: ephemere,
    });

    return NextResponse.redirect(urlAutorisation(requete.token));
  } catch (err) {
    // Le message peut reprendre le corps de la réponse Trello ; il ne contient
    // jamais de secret — la signature part en en-tête, pas en query string.
    console.error("[trello] demande de jeton de requête échouée", err);
    return echec("oauth");
  }
}
