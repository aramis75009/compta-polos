// Sauvegarde et restauration d'une session de mise en vente.
//
// PUR pour la partie sérialisation (testée) ; les deux fonctions qui touchent
// `sessionStorage` sont des enveloppes minces, sans logique.
//
// ⚠️ CLÉ VERSIONNÉE. L'ancien format (`mev_state`) était un objet PLAT décrivant
// UN article. Le relire avec le nouveau code produirait un état incohérent :
// des champs absents, `fiches` undefined, et un écran blanc. On change donc de
// clé plutôt que de tenter une migration — une session en cours ne vaut pas le
// risque, et l'ancienne clé est purgée au passage.

import {
  ficheVide,
  type ArticleEnCours,
  type EtatMev,
  type Qcm,
} from "./_reducer";

const CLE = "mev_session_v2";
/** Ancienne clé, format mono-article. Purgée, jamais lue. */
const CLE_OBSOLETE = "mev_state";
const VERSION = 2;

/**
 * Ce qui survit à un rafraîchissement.
 *
 * Volontairement PAS l'article résolu : un `ArticleDTO` est sérialisable, mais
 * il porte un statut et un prix qui ont pu changer entre-temps. On garde le
 * SKU et on relance la recherche — c'est une requête, et la donnée est fraîche.
 *
 * Les photos ne survivent pas : un `Blob` ne rentre pas dans `sessionStorage`.
 * C'est une limite du navigateur, pas un choix — l'écran doit le dire.
 */
type FicheSerialisee = {
  id: string;
  sku: string;
  qcm: Qcm;
  promptId: string | null;
  annonce: { titre: string; description: string; motsCles: string };
  /** Vrai si une annonce avait été générée : l'étape Export reste atteignable. */
  genere: boolean;
};

type SessionSerialisee = {
  version: number;
  fiches: FicheSerialisee[];
  active: string;
};

export function serialiser(etat: EtatMev): SessionSerialisee {
  return {
    version: VERSION,
    active: etat.active,
    fiches: etat.fiches.map((f) => ({
      id: f.id,
      sku: f.sku,
      qcm: f.qcm,
      promptId: f.promptId,
      annonce: f.annonce,
      genere: f.generation.phase === "ok",
    })),
  };
}

/**
 * Reconstruit un état depuis une charge utile brute.
 *
 * Renvoie `null` sur tout ce qui n'est pas exactement le format attendu :
 * mauvaise version, structure inconnue, tableau vide. Mieux vaut repartir
 * d'une session neuve qu'afficher un écran à moitié restauré.
 */
export function deserialiser(brut: unknown): EtatMev | null {
  if (!brut || typeof brut !== "object") return null;
  const s = brut as Partial<SessionSerialisee>;
  if (s.version !== VERSION) return null;
  if (!Array.isArray(s.fiches) || s.fiches.length === 0) return null;

  const fiches: ArticleEnCours[] = [];
  for (const f of s.fiches) {
    if (!f || typeof f.id !== "string" || typeof f.sku !== "string") return null;
    const base = ficheVide(f.id);
    fiches.push({
      ...base,
      sku: f.sku,
      qcm: { ...base.qcm, ...(f.qcm ?? {}) },
      promptId: f.promptId ?? null,
      annonce: { ...base.annonce, ...(f.annonce ?? {}) },
      // Les photos sont perdues : la fiche redevient « prete » au mieux, et
      // l'appelant relance les recherches de SKU.
      generation: f.genere && f.annonce?.titre
        ? {
            phase: "ok",
            resultat: {
              titre: f.annonce.titre,
              description: f.annonce.description ?? "",
              motsCles: f.annonce.motsCles ?? "",
              promptNom: "",
            },
          }
        : { phase: "vide" },
    });
  }

  const active = fiches.some((f) => f.id === s.active) ? s.active! : fiches[0].id;
  // On revient toujours à l'étape 1 : sans photos, les étapes 2 et 3 n'ont
  // rien à montrer. L'étape 4 reste atteignable si du texte a survécu.
  const etape = fiches.some((f) => f.generation.phase === "ok") ? 4 : 1;
  return { fiches, active, etape };
}

/** Y a-t-il quelque chose à sauver ? Une session vierge ne mérite pas d'écriture. */
export function meriteSauvegarde(etat: EtatMev): boolean {
  return etat.fiches.some(
    (f) => f.sku.trim() !== "" || f.annonce.titre !== "" || f.qcm.taille !== "",
  );
}

// ── Enveloppes sessionStorage (non testées : elles n'ont pas de logique) ───

export function ecrire(etat: EtatMev): void {
  try {
    window.sessionStorage.removeItem(CLE_OBSOLETE);
    if (!meriteSauvegarde(etat)) {
      window.sessionStorage.removeItem(CLE);
      return;
    }
    window.sessionStorage.setItem(CLE, JSON.stringify(serialiser(etat)));
  } catch {
    /* quota dépassé ou stockage refusé : la session ne survivra pas, tant pis */
  }
}

export function lire(): EtatMev | null {
  try {
    window.sessionStorage.removeItem(CLE_OBSOLETE);
    const brut = window.sessionStorage.getItem(CLE);
    return brut ? deserialiser(JSON.parse(brut)) : null;
  } catch {
    return null;
  }
}

export function effacer(): void {
  try {
    window.sessionStorage.removeItem(CLE);
    window.sessionStorage.removeItem(CLE_OBSOLETE);
  } catch {
    /* ignore */
  }
}
