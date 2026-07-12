// Sélection et compilation des prompts d'annonce (pur, client + serveur).
import type { PromptTemplateDTO } from "./types";

// Prompt de repli basique, créé au démarrage si aucun n'existe (cf. promptsServer).
export const DEFAULT_PROMPT_CONTENU = `Tu es un expert de la vente de vêtements d'occasion sur Vinted.
À partir des photos et des informations ci-dessous, rédige une annonce attractive et honnête.

Article : {marque} {categorie}
Taille : {taille}
État : {etat}
Matière : {matiere}
Référence interne : {sku}

Réponds UNIQUEMENT avec un objet JSON valide ayant exactement ces clés :
- "titre" : titre accrocheur, max 80 caractères, incluant marque et type d'article
- "description" : description vendeuse et détaillée (état, matière, coupe, conseils de style), 3 à 6 phrases
- "motsCles" : mots-clés de référencement séparés par des virgules`;

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

/**
 * Choisit le prompt le plus pertinent pour un article, par précision décroissante :
 * 1. marque + catégorie exactes
 * 2. marque exacte (catégorie « toutes »)
 * 3. catégorie exacte (marque « toutes »)
 * 4. prompt marqué par défaut
 * Renvoie null si la liste est vide.
 */
export function pickPrompt(
  prompts: PromptTemplateDTO[],
  marque: string | null,
  categorie: string | null,
): PromptTemplateDTO | null {
  const m = norm(marque);
  const c = norm(categorie);

  const exact = prompts.find(
    (p) => p.marque && p.categorie && norm(p.marque) === m && norm(p.categorie) === c,
  );
  if (exact) return exact;

  const parMarque = prompts.find((p) => p.marque && !p.categorie && norm(p.marque) === m);
  if (parMarque) return parMarque;

  const parCategorie = prompts.find(
    (p) => p.categorie && !p.marque && norm(p.categorie) === c,
  );
  if (parCategorie) return parCategorie;

  const defaut = prompts.find((p) => p.estDefaut);
  if (defaut) return defaut;

  return null;
}

export type PromptVars = {
  marque?: string | null;
  categorie?: string | null;
  taille?: string | null;
  etat?: string | null;
  matiere?: string | null;
  sku?: string | null;
  details?: string | null;
};

/** Remplace les placeholders {marque} {categorie} {taille} {etat} {matiere} {sku} {details}. */
export function compilePrompt(contenu: string, vars: PromptVars): string {
  const details = (vars.details ?? "").trim();
  const map: Record<string, string> = {
    marque: vars.marque ?? "",
    categorie: vars.categorie ?? "",
    taille: vars.taille ?? "",
    etat: vars.etat ?? "",
    matiere: vars.matiere ?? "",
    sku: vars.sku ?? "",
    details,
  };
  const compiled = contenu.replace(
    /\{(marque|categorie|taille|etat|matiere|sku|details)\}/g,
    (_, k) => map[k] ?? "",
  );
  // Les prompts déjà enregistrés en base ne contiennent pas {details} : sans ce
  // repli, les infos supplémentaires saisies seraient purement ignorées.
  if (details && !contenu.includes("{details}")) {
    return `${compiled}\n\nInfos supplémentaires : ${details}`;
  }
  return compiled;
}
