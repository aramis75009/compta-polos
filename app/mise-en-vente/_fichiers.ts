// Tri des fichiers arrivant par glisser-déposer ou par collage.
//
// Pur : ne connaît ni le DOM ni React, seulement des objets qui portent un nom
// et un type MIME. C'est ce qui le rend testable sans jsdom.

/**
 * Extensions retenues quand le navigateur n'a pas su nommer le type.
 * Doit rester alignée sur `ACCEPT_IMAGES` du sélecteur de fichiers.
 */
const EXTENSIONS_IMAGES = [".jpg", ".jpeg", ".png", ".heic", ".heif"];

/** Ce que `fichiersImages` a besoin de connaître d'un fichier. */
export type FichierCandidat = { name: string; type: string };

/** Les seuls fichiers que le pipeline photo sait ouvrir, dans l'ordre reçu. */
export function fichiersImages<T extends FichierCandidat>(fichiers: T[]): T[] {
  return fichiers.filter(estImage);
}

function estImage(fichier: FichierCandidat): boolean {
  if (fichier.type.startsWith("image/")) return true;
  // Un HEIC glissé depuis le Finder ou Photos arrive régulièrement avec
  // type === "" : macOS ne renseigne pas toujours le type MIME. Filtrer sur le
  // seul type MIME écarterait donc les photos d'iPhone, qui sont le cas
  // nominal ici. On se rabat alors sur l'extension.
  if (fichier.type !== "") return false;
  const nom = fichier.name.toLowerCase();
  return EXTENSIONS_IMAGES.some((ext) => nom.endsWith(ext));
}
