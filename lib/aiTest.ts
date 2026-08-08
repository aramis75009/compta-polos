// Test de validité d'une clé IA (serveur uniquement).
//
// Chaque test est une lecture : on liste les modèles ou on interroge le compte.
// Aucune génération n'est déclenchée — vérifier une clé ne doit rien coûter à
// l'utilisateur ni consommer son quota.

export type Fournisseur = "gemini" | "anthropic" | "openrouter";

export type ResultatTest = { ok: boolean; message: string };

async function verdict(res: Response, ok: string): Promise<ResultatTest> {
  if (res.ok) return { ok: true, message: ok };
  if (res.status === 401 || res.status === 403) {
    return { ok: false, message: "Clé refusée par le fournisseur." };
  }
  return { ok: false, message: `Le fournisseur a répondu ${res.status}.` };
}

export async function testerCle(
  fournisseur: Fournisseur,
  cle: string,
): Promise<ResultatTest> {
  try {
    switch (fournisseur) {
      case "gemini": {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cle)}`,
          { cache: "no-store" },
        );
        return verdict(res, "Clé Gemini valide.");
      }
      case "anthropic": {
        const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
          headers: { "x-api-key": cle, "anthropic-version": "2023-06-01" },
          cache: "no-store",
        });
        return verdict(res, "Clé Anthropic valide.");
      }
      case "openrouter": {
        const res = await fetch("https://openrouter.ai/api/v1/key", {
          headers: { Authorization: `Bearer ${cle}` },
          cache: "no-store",
        });
        return verdict(res, "Clé OpenRouter valide.");
      }
    }
  } catch (e) {
    console.error(`[ia] test de clé ${fournisseur} injoignable`, e);
    return { ok: false, message: "Fournisseur injoignable." };
  }
}
