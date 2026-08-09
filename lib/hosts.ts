// Séparation vitrine / application par nom de domaine.
//
// La landing et l'app vivent dans le même projet Next et le même déploiement,
// mais sur deux hôtes distincts. Le découpage est piloté par deux variables
// publiques ; TANT QU'ELLES SONT ABSENTES, RIEN NE CHANGE — l'application
// continue de tout servir sur un seul domaine, comme aujourd'hui. C'est ce qui
// permet de livrer ce code avant d'avoir reconfiguré Vercel.
//
// ⚠️ La session est un cookie, et un cookie appartient à un hôte. Tout ce qui
// authentifie (/login, /signup, /reset-password) doit donc vivre sur l'hôte de
// l'application, jamais sur la vitrine : une inscription faite sur la vitrine
// poserait le cookie au mauvais endroit et l'utilisateur arriverait déconnecté.

const nettoyer = (v: string | undefined) =>
  v
    ?.trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "") || null;

export const HOTE_VITRINE = nettoyer(process.env.NEXT_PUBLIC_LANDING_HOST);
export const HOTE_APP = nettoyer(process.env.NEXT_PUBLIC_APP_HOST);

/** Vrai quand les deux hôtes sont configurés et différents. */
export const HOTES_SEPARES = Boolean(
  HOTE_VITRINE && HOTE_APP && HOTE_VITRINE !== HOTE_APP,
);

/** Seules ces routes sont servies par la vitrine. */
export function estRouteVitrine(pathname: string): boolean {
  return pathname === "/" || pathname.startsWith("/legal");
}

/**
 * Origine publique réellement servie, déduite de la requête.
 *
 * ⚠️ À préférer systématiquement à `NEXTAUTH_URL` et à `request.nextUrl`. La
 * première est une variable d'environnement qui ment dès qu'on change de
 * domaine ; la seconde est alignée par Auth.js sur cette même variable. Se
 * fier à l'une ou à l'autre, c'est renvoyer l'utilisateur se connecter sur un
 * domaine qu'il n'a pas demandé — et y poser le cookie de session.
 */
export function origineDe(req: Request): string {
  const h = req.headers;
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto =
    h.get("x-forwarded-proto") ??
    (hote.startsWith("localhost") || hote.startsWith("127.0.0.1")
      ? "http"
      : "https");
  return `${proto}://${hote}`;
}

/**
 * Lien vers l'application depuis la vitrine.
 *
 * Absolu quand les hôtes sont séparés, relatif sinon. Sans cela, chaque CTA de
 * la landing coûterait une redirection.
 */
export function lienApp(chemin: string): string {
  return HOTES_SEPARES ? `https://${HOTE_APP}${chemin}` : chemin;
}
