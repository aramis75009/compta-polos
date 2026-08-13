// Réglages par utilisateur (serveur uniquement) : lecture, déchiffrement et
// résolution en cascade « clé de l'utilisateur → clé d'environnement ».
//
// Le repli sur l'environnement est ce qui rend un nouveau compte opérationnel
// avant d'avoir saisi la moindre clé. Il n'est pas une position tenable à
// grande échelle — les appels d'un utilisateur sont alors facturés à l'app.

import { prisma } from "@/lib/prisma";
import { dechiffrerOuNull } from "@/lib/crypto";
import type { UserSettings } from "@prisma/client";

/** Tout ce qu'il faut pour appeler l'API Trello au nom d'un utilisateur. */
export type TrelloContexte = {
  key: string;
  token: string;
  /** Secret d'API, uniquement pour valider la signature des webhooks entrants. */
  secret: string | null;
  boardId: string | null;
  /**
   * Vrai seulement si le board vient des réglages DE CE COMPTE.
   *
   * ⚠️ Garde-fou indispensable pour toute ÉCRITURE sur Trello. Sans board
   * choisi, la cascade retombe sur `TRELLO_BOARD_ID`, c'est-à-dire le board du
   * propriétaire du déploiement : un compte neuf qui demande la création des
   * colonnes les créerait sur le Trello de quelqu'un d'autre. Les lectures
   * peuvent se contenter du repli ; les écritures, jamais.
   */
  boardDuCompte: boolean;
  /** Étiquette « À comptabiliser » : celle qui déclenche l'entrée en compta. */
  labelId: string | null;
  /** Étiquette « Comptabilisé » : posée après validation. */
  comptabiliseLabelId: string | null;
};

export type ReglagesResolus = {
  anthropicKey: string | null;
  openrouterKey: string | null;
  trello: TrelloContexte | null;
  /** Identifiant OpenRouter du modèle qui rédige les annonces. */
  modeleIA: string | null;
  objectifMensuel: number | null;
  /** Vrai si la valeur vient du compte, faux si elle vient de l'environnement. */
  source: {
    anthropic: "utilisateur" | "app" | "absente";
    openrouter: "utilisateur" | "app" | "absente";
    trello: "utilisateur" | "app" | "absente";
  };
};

const vide = (s: string | null | undefined) =>
  s && s.trim() ? s.trim() : null;

/** Ligne brute des réglages, secrets encore chiffrés. */
export function reglagesBruts(userId: string): Promise<UserSettings | null> {
  return prisma.userSettings.findUnique({ where: { userId } });
}

/**
 * Résout la configuration effective d'un utilisateur.
 *
 * Un secret illisible (clé maîtresse changée, colonne corrompue) ne fait pas
 * échouer l'appel : `dechiffrerOuNull` journalise et renvoie null, ce qui fait
 * retomber la cascade sur l'environnement. Le contraire priverait l'utilisateur
 * de génération d'annonces à cause d'un champ facultatif.
 */
export async function resoudreReglages(
  userId: string,
): Promise<ReglagesResolus> {
  const s = await reglagesBruts(userId);

  const cascade = (
    duCompte: string | null,
    delApp: string | undefined,
  ): [string | null, "utilisateur" | "app" | "absente"] => {
    if (duCompte) return [duCompte, "utilisateur"];
    const env = vide(delApp);
    return env ? [env, "app"] : [null, "absente"];
  };

  const [anthropic, srcAnthropic] = cascade(
    dechiffrerOuNull(s?.anthropicKey),
    process.env.ANTHROPIC_API_KEY,
  );
  const [openrouter, srcOpenrouter] = cascade(
    dechiffrerOuNull(s?.openrouterKey),
    process.env.OPENROUTER_API_KEY,
  );

  // Trello : clé ET token vont ensemble. Une clé d'utilisateur avec un token
  // d'environnement n'aurait aucun sens — les deux forment un même accès.
  const trelloKeyCompte = dechiffrerOuNull(s?.trelloKey);
  const trelloTokenCompte = dechiffrerOuNull(s?.trelloToken);
  let trello: TrelloContexte | null = null;
  let srcTrello: "utilisateur" | "app" | "absente" = "absente";

  if (trelloKeyCompte && trelloTokenCompte) {
    srcTrello = "utilisateur";
    trello = {
      key: trelloKeyCompte,
      token: trelloTokenCompte,
      secret: dechiffrerOuNull(s?.trelloSecret),
      boardId: vide(s?.trelloBoardId),
      boardDuCompte: Boolean(vide(s?.trelloBoardId)),
      labelId: vide(s?.trelloLabelId),
      comptabiliseLabelId: vide(s?.trelloComptabiliseLabelId),
    };
  } else {
    const key = vide(process.env.TRELLO_API_KEY);
    const token = vide(process.env.TRELLO_TOKEN);
    if (key && token) {
      srcTrello = "app";
      trello = {
        key,
        token,
        secret:
          dechiffrerOuNull(s?.trelloSecret) ?? vide(process.env.TRELLO_SECRET),
        // Les ids du compte l'emportent même quand l'accès vient de l'app :
        // Aramis peut viser son board avec les clés du déploiement.
        boardId: vide(s?.trelloBoardId) ?? vide(process.env.TRELLO_BOARD_ID),
        boardDuCompte: Boolean(vide(s?.trelloBoardId)),
        labelId: vide(s?.trelloLabelId) ?? vide(process.env.TRELLO_LABEL_ID),
        comptabiliseLabelId:
          vide(s?.trelloComptabiliseLabelId) ??
          vide(process.env.TRELLO_COMPTABILISE_LABEL_ID),
      };
    }
  }

  return {
    anthropicKey: anthropic,
    openrouterKey: openrouter,
    trello,
    modeleIA: vide(s?.modeleIA),
    objectifMensuel: s?.objectifMensuel ?? null,
    source: {
      anthropic: srcAnthropic,
      openrouter: srcOpenrouter,
      trello: srcTrello,
    },
  };
}

/**
 * Contexte Trello d'un utilisateur, ou `null` s'il n'a aucun accès utilisable.
 * Les appels Trello sont best-effort (cf. CLAUDE.md) : l'absence de contexte
 * doit faire renoncer à la synchro, jamais échouer l'opération métier.
 */
export async function contexteTrello(
  userId: string,
): Promise<TrelloContexte | null> {
  return (await resoudreReglages(userId)).trello;
}

/**
 * Retrouve l'utilisateur propriétaire d'un board Trello.
 *
 * C'est le routage du webhook entrant, qui n'a pas de session : il ne porte que
 * l'id du board. `UserSettings.trelloBoardId` est unique, donc la réponse est
 * sans ambiguïté. Repli sur `TRELLO_BOARD_ID` + `TRELLO_OWNER_EMAIL` tant que
 * l'utilisateur historique n'a pas basculé sur ses propres réglages.
 */
export async function utilisateurDuBoard(
  boardId: string,
): Promise<string | null> {
  const parReglages = await prisma.userSettings.findUnique({
    where: { trelloBoardId: boardId },
    select: { userId: true },
  });
  if (parReglages) return parReglages.userId;

  if (vide(process.env.TRELLO_BOARD_ID) !== boardId) return null;

  const email = vide(process.env.TRELLO_OWNER_EMAIL);
  const proprietaire = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true } })
    : await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
  return proprietaire?.id ?? null;
}
