// Objectif de CA mensuel — réglé dans Paramètres, lu par le Dashboard (anneau
// de progression).
//
// Il vit maintenant sur le compte (`UserSettings.objectifMensuel`), plus dans le
// localStorage : un réglage rangé dans le navigateur ne suit pas l'utilisateur
// d'un appareil à l'autre, et deux comptes partageant un poste voyaient le même
// objectif. Les hooks sont dans `lib/hooks.ts`.
//
// Ce qui reste ici est la reprise de l'ancienne valeur, une seule fois.

const KEY = "myflip-objectif-mensuel";

/** Ancienne valeur laissée dans ce navigateur, s'il y en a une. */
export function objectifLegacy(): number | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Efface l'ancienne valeur, une fois reprise sur le compte. */
export function oublierObjectifLegacy(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
