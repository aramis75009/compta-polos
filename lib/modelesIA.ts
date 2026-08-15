// Catalogue des modèles proposés pour la génération d'annonces.
//
// Module PARTAGÉ client/serveur, et volontairement sans dépendance : il est
// importé par `components/compte/Integrations.tsx` (composant client) autant que
// par la route de génération. Y ajouter un import serveur ferait entrer le SDK
// et les secrets dans le bundle navigateur.
//
// ⚠️ Deux capacités sont NON NÉGOCIABLES pour figurer ici :
//   • lecture d'image en entrée  — l'annonce est écrite à partir des photos ;
//   • sortie JSON structurée     — la réponse est parsée, pas lue par un humain.
// Un modèle qui n'a pas les deux échoue à CHAQUE génération, pas une fois sur
// dix. La liste ci-dessous a été relevée sur `openrouter.ai/api/v1/models` en
// filtrant sur `input_modalities: image` + `supported_parameters:
// structured_outputs` — refaire ce filtrage avant d'y ajouter une ligne.

export type ModelePropose = {
  /** Identifiant OpenRouter, tel qu'attendu par le champ `model` de l'API. */
  id: string;
  libelle: string;
  /** Repère de coût affiché à côté du nom, en $ par million de tokens. */
  prix: string;
  note: string;
};

/**
 * Modèle utilisé quand le compte n'a rien choisi.
 *
 * C'est exactement le modèle qui rédigeait les annonces avant le passage par
 * OpenRouter. Le défaut ne change donc RIEN à la qualité des sorties : seule la
 * facturation change de guichet. Un défaut « moins cher » aurait obligé à
 * re-régler les prompts, qui sont calibrés (titre saturé à 100 caractères,
 * ~80 mots-clés sur 7 langues) sur le comportement de ce modèle-là.
 */
export const MODELE_PAR_DEFAUT = "google/gemini-3.6-flash";

export const MODELES_PROPOSES: ModelePropose[] = [
  {
    id: "google/gemini-3.6-flash",
    libelle: "Gemini 3.6 Flash",
    prix: "0.75 / 3.75",
    note: "Le modèle d'avant. Mêmes annonces, autre facture.",
  },
  {
    id: "google/gemini-3.7-flash",
    libelle: "Gemini 3.7 Flash",
    prix: "0.38 / 1.88",
    note: "Plus récent et moins cher que 3.6 Flash, même famille.",
  },
  {
    id: "google/gemini-3.5-flash-lite",
    libelle: "Gemini 3.5 Flash Lite",
    prix: "0.30 / 2.50",
    note: "Cinq fois moins cher, même famille.",
  },
  {
    id: "anthropic/claude-haiku-4.5",
    libelle: "Claude Haiku 4.5",
    prix: "1.00 / 5.00",
    note: "À l'aise sur les mots-clés multilingues.",
  },
  {
    id: "anthropic/claude-sonnet-4.6",
    libelle: "Claude Sonnet 4.6",
    prix: "3.00 / 15.00",
    note: "Pour les pièces qui méritent une annonce impeccable.",
  },
  {
    id: "openai/gpt-5.4-mini",
    libelle: "GPT-5.4 mini",
    prix: "0.75 / 4.50",
    note: "Autre famille, utile en repli.",
  },
];

/**
 * Catalogue SÉPARÉ pour l'assistant conversationnel (bulle en bas à droite).
 *
 * L'assistant n'a besoin ni de lire des images ni de sortie JSON forcée : il
 * lui faut seulement l'appel d'outils (`tools`, function calling). C'est une
 * exigence plus large, mais pas superposable à `MODELES_PROPOSES` — DeepSeek,
 * utile ici pour son prix, n'a AUCUNE capacité image sur OpenRouter et ne
 * pourrait jamais figurer dans le catalogue des annonces.
 *
 * Vérifier `input_modalities` (peu importe pour ce catalogue) et
 * `supported_parameters: tools` sur `openrouter.ai/api/v1/models` avant d'y
 * ajouter une ligne.
 */
export const MODELES_CHAT_PROPOSES: ModelePropose[] = [
  {
    id: "anthropic/claude-sonnet-4.6",
    libelle: "Claude Sonnet 4.6",
    prix: "3.00 / 15.00",
    note: "Le modèle qui faisait déjà tourner l'assistant, via Anthropic direct.",
  },
  {
    id: "google/gemini-3.7-flash",
    libelle: "Gemini 3.7 Flash",
    prix: "0.38 / 1.88",
    note: "Rapide et très économique pour des échanges courts.",
  },
  {
    id: "deepseek/deepseek-v4-flash-0731",
    libelle: "DeepSeek V4 Flash",
    prix: "0.14 / 0.28",
    note: "Le moins cher du lot. Pas d'image, sans importance ici.",
  },
  {
    id: "openai/gpt-5.4-mini",
    libelle: "GPT-5.4 mini",
    prix: "0.75 / 4.50",
    note: "Autre famille, utile en repli.",
  },
];

/**
 * Modèle utilisé par l'assistant quand le compte n'a rien choisi.
 *
 * C'est exactement le modèle codé en dur dans `/api/chat` avant le passage par
 * OpenRouter (`claude-sonnet-4-6` côté SDK Anthropic) : le défaut ne change
 * donc rien à la qualité des réponses, seule la facturation change de guichet.
 */
export const MODELE_CHAT_PAR_DEFAUT = "anthropic/claude-sonnet-4.6";

/** Vrai si l'identifiant ne fait pas partie du catalogue chat. */
export function estModeleChatLibre(id: string | null): boolean {
  if (!id) return false;
  return !MODELES_CHAT_PROPOSES.some((m) => m.id === id);
}

/** Vrai si l'identifiant ne fait pas partie de la liste courte. */
export function estModeleLibre(id: string | null): boolean {
  if (!id) return false;
  return !MODELES_PROPOSES.some((m) => m.id === id);
}

/**
 * Nom lisible d'un modèle, pour l'affichage.
 *
 * Un identifiant hors liste est rendu tel quel : c'est ce que l'utilisateur a
 * tapé, et le masquer derrière « Personnalisé » l'empêcherait de vérifier ce
 * qui tourne réellement. `null` = rien de choisi, donc le défaut.
 */
export function libelleModele(id: string | null): string {
  const cible = id?.trim() || MODELE_PAR_DEFAUT;
  return MODELES_PROPOSES.find((m) => m.id === cible)?.libelle ?? cible;
}
