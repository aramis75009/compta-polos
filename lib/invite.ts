// Codes d'invitation.
//
// La landing est publique, donc /signup l'est aussi. Tant qu'il n'y a ni
// paiement, ni vérification d'e-mail, ni quota, ce code est le SEUL verrou
// entre internet et la création d'un compte sur la base Neon — un compte qui
// consomme les clés IA du déploiement.
//
// Fermé par défaut, jamais ouvert par défaut : sans INVITE_CODES, aucune
// inscription n'est possible. Une variable oubliée doit bloquer, pas ouvrir.
//
// Ajouter un code = modifier INVITE_CODES en local et sur Vercel. Le jour où il
// faut savoir qui a utilisé quoi, ce fichier devient un modèle Prisma sans que
// les appelants changent.

/** Codes acceptés, normalisés en majuscules. */
function codesAutorises(): string[] {
  return (process.env.INVITE_CODES ?? "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * `true` si le code fourni ouvre droit à une inscription.
 * La comparaison ignore la casse et les espaces autour.
 */
export function inviteCodeValide(saisi: string | null | undefined): boolean {
  const autorises = codesAutorises();
  if (autorises.length === 0) {
    console.warn(
      "[invite] INVITE_CODES absente ou vide — toutes les inscriptions sont refusées.",
    );
    return false;
  }

  const code = (saisi ?? "").trim().toUpperCase();
  if (!code) return false;

  return autorises.includes(code);
}
