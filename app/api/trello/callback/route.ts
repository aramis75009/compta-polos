import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/apiAuth";
import { chiffrer, dechiffrerOuNull } from "@/lib/crypto";
import { origineDe } from "@/lib/hosts";
import { credentialsApp, echangerAccessToken, identiteMembre } from "@/lib/trelloOAuth";
import { retourAvecCode } from "@/lib/trelloCallback";
import type { CodeErreurTrello } from "@/lib/trelloErreurs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trello/callback — retour de Trello après autorisation.
//
// Trois vérifications avant d'échanger quoi que ce soit :
//   1. la requête est authentifiée ;
//   2. l'oauth_token reçu est bien celui qu'on a stocké POUR CE COMPTE ;
//   3. il n'a pas expiré.
//
// La deuxième est la protection CSRF du parcours : sans elle, un tiers pourrait
// faire rattacher SON compte Trello à la session d'un autre utilisateur, et
// lirait ensuite ses articles à travers le webhook.
export async function GET(req: NextRequest) {
  const origine = origineDe(req);
  const depuis =
    req.nextUrl.searchParams.get("depuis") === "demarrage" ? "/demarrage" : "/compte";
  const retour = (code: CodeErreurTrello | "ok") =>
    NextResponse.redirect(retourAvecCode(origine, depuis, code));

  // Route de navigation, et l'aller-retour par Trello peut durer plusieurs
  // minutes : une session expirée entre-temps doit ramener vers /login, pas
  // afficher un JSON dans la barre d'adresse. Le jeton de requête reste alors
  // en base, mais il périme tout seul au bout de dix minutes.
  const userId = await getUserId();
  if (!userId) return NextResponse.redirect(`${origine.replace(/\/$/, "")}/login`);

  const recu = req.nextUrl.searchParams.get("oauth_token");
  const verifier = req.nextUrl.searchParams.get("oauth_verifier");

  const s = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      trelloOauthRequestToken: true,
      trelloOauthRequestSecret: true,
      trelloOauthExpire: true,
    },
  });

  // Un jeton de requête est à USAGE UNIQUE : on l'efface quelle que soit
  // l'issue. Le garder ouvrirait une fenêtre de rejeu de dix minutes.
  const effacerEphemere = () =>
    prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
      },
    });

  // Refus de l'utilisateur : Trello renvoie sans oauth_verifier.
  if (!verifier) {
    if (s?.trelloOauthRequestToken) await effacerEphemere();
    return retour("refus");
  }

  if (!recu || !s?.trelloOauthRequestToken || recu !== s.trelloOauthRequestToken) {
    console.warn("[trello] callback rejeté : jeton de requête non concordant");
    if (s?.trelloOauthRequestToken) await effacerEphemere();
    return retour("callback-invalide");
  }

  if (!s.trelloOauthExpire || s.trelloOauthExpire.getTime() < Date.now()) {
    await effacerEphemere();
    return retour("demande-expiree");
  }

  const secretRequete = dechiffrerOuNull(s.trelloOauthRequestSecret);
  const app = credentialsApp();
  if (!secretRequete || !app) {
    await effacerEphemere();
    return retour(app ? "oauth" : "non-configure");
  }

  try {
    const acces = await echangerAccessToken(
      { token: recu, secret: secretRequete },
      verifier,
    );

    // L'identité ne sert qu'à afficher « connecté en tant que … ». Son échec ne
    // doit pas faire perdre un jeton qu'on vient tout juste d'obtenir.
    let membre: { id: string; nom: string } | null = null;
    try {
      membre = await identiteMembre(app.key, acces.token);
    } catch (e) {
      console.error("[trello] lecture de l'identité du membre échouée", e);
    }

    await prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthToken: chiffrer(acces.token),
        trelloOauthTokenSecret: chiffrer(acces.secret),
        trelloMembreId: membre?.id ?? null,
        trelloMembreNom: membre?.nom ?? null,
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
      },
    });

    return retour("ok");
  } catch (err) {
    console.error("[trello] échange du jeton d'accès échoué", err);
    await effacerEphemere();
    return retour("oauth");
  }
}
