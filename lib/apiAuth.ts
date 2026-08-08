// Garde d'authentification des routes API.
//
// Pourquoi ce fichier existe : le `matcher` de middleware.ts exclut `api`, donc
// AUCUNE route sous app/api n'est protégée par le middleware. Chaque route doit
// vérifier la session elle-même, et scoper ses requêtes Prisma par userId.
//
// Pourquoi `getUserId` renvoie null au lieu de lever : la quasi-totalité des
// routes enveloppent leur corps dans un try/catch qui renvoie 500. Une
// exception y serait avalée et transformée en « Erreur serveur » alors que le
// vrai sens est « non authentifié ». Un retour nullable force le traitement sur
// place, en deux lignes, et reste correct où qu'on le place.
//
//   const userId = await getUserId();
//   if (!userId) return unauthorized();
//
// À partir de là, `userId` est non-null pour TypeScript et doit apparaître dans
// le `where` de chaque requête — y compris les agrégats et les accès par id.

import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Identifiant de l'utilisateur de la session courante, ou `null` si la requête
 * n'est pas authentifiée. Alimenté par le callback `session` d'auth.config.ts.
 */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Réponse 401 standard, au même format d'erreur que le reste de l'API. */
export function unauthorized() {
  return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
}

/**
 * Réponse 404 pour une ressource qui existe peut-être, mais pas pour cet
 * utilisateur. On ne renvoie jamais 403 : distinguer « ça n'existe pas » de
 * « ça ne vous appartient pas » révélerait l'existence des données d'autrui.
 */
export function notFound(quoi = "Ressource") {
  return NextResponse.json({ error: `${quoi} introuvable.` }, { status: 404 });
}
