// Options du wizard « Mise en vente » (partagées client/serveur, pures).

export const TAILLES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "Unique",
] as const;

export const ETATS = [
  "Neuf avec étiquette",
  "Neuf sans étiquette",
  "Très bon état",
  "Bon état",
  "Satisfaisant",
] as const;

export const MATIERES_SUGGESTIONS = [
  "Coton",
  "Coton piqué",
  "Polyester",
  "Laine",
  "Lin",
  "Cuir",
  "Jean / Denim",
  "Cachemire",
  "Nylon",
  "Viscose",
] as const;
