// Construction et validation de l'URL de retour OAuth.
//
// Isolé des routes pour être testable : ce sont exactement les trois décisions
// qui, mal prises, ouvrent une redirection non maîtrisée ou envoient
// l'utilisateur atterrir sur un domaine qu'il n'a pas demandé.

import type { CodeErreurTrello } from "@/lib/trelloErreurs";

const CHEMIN_CALLBACK = "/api/trello/callback";

/**
 * URL que Trello appellera au retour.
 *
 * Déduite de l'origine RÉELLEMENT servie, jamais de `NEXTAUTH_URL` — cf.
 * `origineDe` dans `lib/hosts.ts` : la variable ment dès qu'on change de
 * domaine, et la signature du webhook, elle aussi, porte sur l'URL réelle.
 */
export function urlCallback(origine: string): string {
  return `${origine.replace(/\/$/, "")}${CHEMIN_CALLBACK}`;
}

/**
 * L'origine servie est-elle une origine légitime de l'application ?
 *
 * Quand `NEXT_PUBLIC_APP_HOST` est configuré, la vitrine et l'application vivent
 * sur deux hôtes : une connexion Trello initiée depuis la vitrine ferait
 * atterrir le retour au mauvais endroit, là où la session n'existe pas.
 * `localhost` reste accepté, sinon le développement local devient impossible
 * dès que la séparation est configurée.
 */
export function origineAutorisee(origine: string, hoteApp: string | null): boolean {
  if (!hoteApp) return true;
  let hote: string;
  try {
    hote = new URL(origine).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hote === "localhost" || hote === "127.0.0.1") return true;
  return hote === hoteApp.toLowerCase();
}

/**
 * Redirection de retour, avec le résultat de la tentative.
 *
 * Le résultat voyage dans l'URL parce que le parcours se termine par une
 * redirection du navigateur : il n'y a pas de réponse JSON à lire.
 */
export function retourAvecCode(
  origine: string,
  chemin: string,
  code: CodeErreurTrello | "ok",
): string {
  return `${origine.replace(/\/$/, "")}${chemin}?trello=${code}`;
}
