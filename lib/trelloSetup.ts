// Préparation d'un board Trello pour MyFlip (serveur uniquement).
//
// Le parti pris du parcours de démarrage : ne pas expliquer comment créer les
// colonnes et les étiquettes, mais les créer. Un tutoriel qu'on n'a pas à
// suivre vaut mieux qu'un tutoriel bien écrit.
//
// Tout est IDEMPOTENT : on relit d'abord ce qui existe, on ne crée que ce qui
// manque. Recliquer sur le bouton ne duplique rien — c'est indispensable, parce
// que l'écriture se fait sur le Trello de l'utilisateur, qui peut déjà avoir
// organisé son board à sa façon.

import {
  createLabel,
  createList,
  listBoardLabels,
  listBoardLists,
} from "@/lib/trello";
import type { TrelloContexte } from "@/lib/settings";
import {
  COLONNES,
  ETIQUETTES_COMPTA,
  TRANSPORTEURS,
} from "@/lib/trelloConstantes";

const cle = (s: string) => s.trim().toLowerCase();

export type ResultatPreparation = {
  colonnes: { creees: string[]; existantes: string[] };
  etiquettes: { creees: string[]; existantes: string[] };
  /** Identifiants des deux étiquettes de comptabilité, à enregistrer. */
  labelId: string | null;
  comptabiliseLabelId: string | null;
};

/**
 * Crée sur le board ce qui manque, et renvoie les identifiants des deux
 * étiquettes de comptabilité.
 *
 * La correspondance se fait sur le NOM, insensible à la casse et aux espaces :
 * un board qui a déjà « à comptabiliser » en minuscules n'en reçoit pas un
 * doublon.
 */
export async function preparerBoard(
  ctx: TrelloContexte,
  boardId: string,
  options: { transporteurs: boolean },
): Promise<ResultatPreparation> {
  const res: ResultatPreparation = {
    colonnes: { creees: [], existantes: [] },
    etiquettes: { creees: [], existantes: [] },
    labelId: null,
    comptabiliseLabelId: null,
  };

  // ── Colonnes ──
  const listes = await listBoardLists(ctx, boardId);
  const nomsListes = new Set(listes.map((l) => cle(l.name)));
  for (const nom of COLONNES) {
    if (nomsListes.has(cle(nom))) {
      res.colonnes.existantes.push(nom);
      continue;
    }
    await createList(ctx, boardId, nom);
    res.colonnes.creees.push(nom);
  }

  // ── Étiquettes ──
  const labels = await listBoardLabels(ctx, boardId);
  const parNom = new Map(
    labels.filter((l) => l.name).map((l) => [cle(l.name), l]),
  );

  const voulues = [
    ...ETIQUETTES_COMPTA,
    ...(options.transporteurs
      ? TRANSPORTEURS.map((t) => ({ ...t, role: null }))
      : []),
  ];

  for (const e of voulues) {
    let existante = parNom.get(cle(e.name));
    if (existante) {
      res.etiquettes.existantes.push(e.name);
    } else {
      existante = await createLabel(ctx, boardId, e.name, e.color);
      parNom.set(cle(e.name), existante);
      res.etiquettes.creees.push(e.name);
    }
    if (e.role === "compta") res.labelId = existante.id;
    if (e.role === "comptabilise") res.comptabiliseLabelId = existante.id;
  }

  return res;
}
