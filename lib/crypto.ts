// Chiffrement des secrets stockés en base (clés IA, accès Trello).
//
// AES-256-GCM : chiffrement authentifié. Le tag d'authentification fait échouer
// le déchiffrement si le stockage a été altéré — un secret corrompu doit lever,
// jamais renvoyer une valeur silencieusement fausse qui partirait dans un
// en-tête d'API.
//
// ⚠️ La perte de `ENCRYPTION_KEY` rend TOUS les secrets stockés illisibles. La
// sauvegarder hors Vercel dès sa génération. La changer invalide l'existant :
// il faudrait déchiffrer avec l'ancienne et rechiffrer avec la nouvelle.

import crypto from "crypto";

const ALGO = "aes-256-gcm";
const IV_OCTETS = 12; // 96 bits, la taille recommandée pour GCM
const TAG_OCTETS = 16;

/**
 * Clé maîtresse, 32 octets, en hexadécimal ou base64 dans `ENCRYPTION_KEY`.
 * Générer avec : `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`
 *
 * Lue à chaque appel plutôt que mémoïsée : un module-level `const` fige la
 * valeur au premier import, ce qui casse les tests et masque une variable
 * ajoutée après le démarrage.
 */
function cleMaitresse(): Buffer {
  const brut = process.env.ENCRYPTION_KEY;
  if (!brut) {
    throw new Error(
      "ENCRYPTION_KEY manquante : impossible de chiffrer ou déchiffrer les secrets.",
    );
  }
  const cle = Buffer.from(brut.trim(), /^[0-9a-fA-F]{64}$/.test(brut.trim()) ? "hex" : "base64");
  if (cle.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY invalide : ${cle.length} octets au lieu de 32 (256 bits).`,
    );
  }
  return cle;
}

/** Vrai si la clé maîtresse est présente et exploitable. */
export function chiffrementDisponible(): boolean {
  try {
    cleMaitresse();
    return true;
  } catch {
    return false;
  }
}

/**
 * Chiffre une valeur. Le résultat est autonome : `iv:tag:données`, tout trois en
 * base64. Pas de format binaire compact — la lisibilité en base vaut plus que
 * les quelques octets économisés, et ça permet de reconnaître un champ non
 * chiffré au premier coup d'œil.
 */
export function chiffrer(clair: string): string {
  const iv = crypto.randomBytes(IV_OCTETS);
  const cipher = crypto.createCipheriv(ALGO, cleMaitresse(), iv);
  const donnees = Buffer.concat([cipher.update(clair, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    tag.toString("base64"),
    donnees.toString("base64"),
  ].join(":");
}

/** Déchiffre une valeur produite par `chiffrer`. Lève si le format ou le tag est invalide. */
export function dechiffrer(stocke: string): string {
  const parts = stocke.split(":");
  if (parts.length !== 3) {
    throw new Error("Secret illisible : format attendu iv:tag:données.");
  }
  const [iv, tag, donnees] = parts.map((p) => Buffer.from(p, "base64"));
  if (iv.length !== IV_OCTETS || tag.length !== TAG_OCTETS) {
    throw new Error("Secret illisible : IV ou tag de taille inattendue.");
  }
  const decipher = crypto.createDecipheriv(ALGO, cleMaitresse(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(donnees), decipher.final()]).toString(
    "utf8",
  );
}

/**
 * Déchiffre sans lever : renvoie `null` si le secret est absent ou illisible.
 *
 * Utilisé sur les chemins où un secret cassé doit faire retomber l'application
 * sur la clé d'environnement plutôt que renvoyer une erreur 500 à l'utilisateur.
 * L'échec est journalisé, jamais avalé en silence.
 */
export function dechiffrerOuNull(stocke: string | null | undefined): string | null {
  if (!stocke) return null;
  try {
    return dechiffrer(stocke);
  } catch (e) {
    console.error("[crypto] secret illisible, repli sur la clé d'environnement", e);
    return null;
  }
}

/**
 * Aperçu non sensible d'un secret, pour l'écran de configuration : les 4
 * derniers caractères. C'est assez pour reconnaître « c'est bien ma clé », trop
 * peu pour la reconstituer.
 */
export function apercuSecret(clair: string): string {
  const fin = clair.trim().slice(-4);
  return fin ? `••••${fin}` : "";
}
