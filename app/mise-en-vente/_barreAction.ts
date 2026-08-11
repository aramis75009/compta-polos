// Ce que dit et fait la barre collante, à chaque étape.
//
// PUR : la fonction rend un DESCRIPTEUR, pas un gestionnaire d'événement.
// L'ancienne version réaffectait six variables mutables au fil de quatre
// branches (`let primaryLabel`, `let primaryEnabled`, `let hint`…) — une
// machine à états écrite en variables locales, illisible dès qu'on ajoute un
// cinquième cas, et impossible à tester sans monter la page.
//
// `page.tsx` traduit `intention` en action ; c'est la seule chose qu'il reste
// à faire, et elle tient en un switch.

import {
  fichePrete,
  manquePourGenerer,
  type ArticleEnCours,
  type EtatMev,
} from "./_reducer";

export type Intention =
  | "continuer" // étape 1 → 2
  | "generer" // lance la file
  | "attendre" // génération en cours, bouton inerte
  | "nouvelle-session";

export type DescripteurBarre = {
  label: string;
  intention: Intention;
  /** Le bouton principal est-il cliquable ? */
  actif: boolean;
  /** Ce que lit l'utilisateur à gauche : soit un encouragement, soit ce qui manque. */
  indice: string;
  /** Vrai quand l'indice est une bonne nouvelle (teinte positive). */
  ok: boolean;
  icone: "fleche" | "etincelles";
  /** Le bouton « Retour » a-t-il un sens ici ? */
  retourPossible: boolean;
};

const pluriel = (n: number, mot: string, suffixe = "s") =>
  `${n} ${mot}${n > 1 ? suffixe : ""}`;

export function descripteurBarre(etat: EtatMev): DescripteurBarre {
  const active =
    etat.fiches.find((f) => f.id === etat.active) ?? etat.fiches[0];

  if (etat.etape === 1) {
    const resolus = etat.fiches.filter((f) => f.article).length;
    return {
      label: "Continuer",
      intention: "continuer",
      actif: resolus > 0,
      indice:
        resolus > 0
          ? `${pluriel(resolus, "article")} ${resolus > 1 ? "trouvés" : "trouvé"}`
          : "Saisis au moins un SKU valide",
      ok: resolus > 0,
      icone: "fleche",
      retourPossible: false,
    };
  }

  if (etat.etape === 2) {
    const pretes = etat.fiches.filter(fichePrete).length;
    return {
      label: pretes > 1 ? `Générer les ${pretes} annonces` : "Générer l'annonce",
      intention: "generer",
      actif: pretes > 0,
      indice:
        pretes > 0
          ? `${pretes} ${pretes > 1 ? "fiches prêtes" : "fiche prête"} sur ${etat.fiches.length}`
          : `Il manque : ${manquePourGenerer(active).join(" · ")}`,
      ok: pretes > 0,
      icone: "etincelles",
      retourPossible: true,
    };
  }

  if (etat.etape === 3) {
    return {
      label: "Génération…",
      intention: "attendre",
      actif: false,
      indice: "Rédaction en cours",
      ok: true,
      icone: "etincelles",
      // Interdire le retour pendant la file : revenir modifier une fiche dont
      // la génération est en vol produirait une annonce qui ne correspond plus.
      retourPossible: false,
    };
  }

  const aEnregistrer = etat.fiches.filter(
    (f: ArticleEnCours) => f.generation.phase === "ok" && !f.enregistre,
  ).length;
  return {
    label: "Nouvelle session",
    intention: "nouvelle-session",
    actif: true,
    indice:
      aEnregistrer > 0
        ? `${pluriel(aEnregistrer, "annonce")} ${aEnregistrer > 1 ? "non enregistrées" : "non enregistrée"}`
        : "Tout est enregistré",
    ok: aEnregistrer === 0,
    icone: "fleche",
    retourPossible: true,
  };
}
