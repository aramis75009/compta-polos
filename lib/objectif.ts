// Objectif de CA mensuel — réglé par l'utilisateur dans Paramètres, lu par le
// Dashboard (anneau de progression). Stocké en localStorage : outil mono-
// utilisateur, aucune dépendance base de données (le déploiement ne touche
// pas la base). Renvoie null si non défini ou invalide.

const KEY = "myflip-objectif-mensuel";

export function getObjectifMensuel(): number | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setObjectifMensuel(n: number | null): void {
  if (typeof window === "undefined") return;
  if (n && Number.isFinite(n) && n > 0) {
    window.localStorage.setItem(KEY, String(Math.round(n)));
  } else {
    window.localStorage.removeItem(KEY);
  }
}
