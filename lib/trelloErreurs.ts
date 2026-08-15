// Traduction des échecs Trello en phrases lisibles.
//
// Module volontairement sans dépendance : il est lu par le serveur (qui choisit
// le code) ET par le navigateur (qui affiche la phrase). Les deux doivent voir
// la même liste — un code sans message afficherait une chaîne vide, c'est-à-dire
// un échec silencieux, exactement ce qu'on cherche à éviter ici.
//
// Le code voyage dans l'URL de retour (`?trello=…`) parce que la connexion
// OAuth se termine par une REDIRECTION : il n'y a pas de réponse JSON à lire,
// le navigateur atterrit simplement sur une page.

export const CODES_ERREUR = [
  "refus",
  "oauth",
  "callback-invalide",
  "demande-expiree",
  "token-invalide",
  "aucun-board",
  "aucune-etiquette",
  "board-supprime",
  "etiquette-supprimee",
  "introuvable",
  "api",
  "non-configure",
] as const;

export type CodeErreurTrello = (typeof CODES_ERREUR)[number];

const MESSAGES: Record<CodeErreurTrello, string> = {
  refus: "La connexion Trello a été refusée. Aucun accès n'a été enregistré.",
  oauth: "La connexion à Trello a échoué. Réessaie dans un instant.",
  "callback-invalide":
    "Ce retour de Trello ne correspond pas à ta demande de connexion. Relance la connexion.",
  "demande-expiree": "Ta demande de connexion a expiré. Relance-la.",
  "token-invalide":
    "Ta connexion Trello n'est plus valide. Reconnecte ton compte Trello.",
  "aucun-board":
    "Aucun tableau accessible avec ce compte Trello. Crée un tableau puis reviens ici.",
  "aucune-etiquette":
    "Ce tableau n'a aucune étiquette. Passe par « Préparer le board » pour les créer.",
  "board-supprime": "Le tableau surveillé n'existe plus. Choisis-en un autre.",
  "etiquette-supprimee":
    "Une des deux étiquettes n'existe plus sur ce tableau. Choisis-la à nouveau.",
  introuvable:
    "Trello ne trouve pas cette ressource. Le tableau ou l'étiquette a peut-être été supprimé.",
  api: "Trello n'a pas répondu correctement. Réessaie dans un instant.",
  "non-configure":
    "La connexion Trello n'est pas configurée sur ce déploiement. Préviens l'administrateur.",
};

export function messageErreur(code: CodeErreurTrello): string {
  return MESSAGES[code] ?? MESSAGES.oauth;
}

/**
 * Statut HTTP renvoyé par l'API Trello → code d'erreur applicatif.
 *
 * 401 est le cas qui compte : c'est ce que Trello renvoie pour un jeton révoqué
 * depuis son compte, ce qui n'est pas une panne mais une décision de
 * l'utilisateur — il faut l'inviter à reconnecter, pas lui dire « réessaie ».
 */
export function codeDepuisStatut(statut: number): CodeErreurTrello {
  if (statut === 401) return "token-invalide";
  if (statut === 404) return "introuvable";
  return "api";
}
