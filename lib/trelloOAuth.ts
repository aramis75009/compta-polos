// Connexion Trello par OAuth 1.0a (serveur uniquement).
//
// ── Pourquoi OAuth 1.0a et pas autre chose ──
// Trello n'expose que deux mécanismes d'autorisation, et PAS d'OAuth 2.0 sur
// son API REST (doc Atlassian, vérifiée le 15/08/2026). L'autre mécanisme, la
// route `/1/authorize`, ne sait rendre le jeton qu'au NAVIGATEUR — fragment
// d'URL ou postMessage, il n'a pas de variante qui le rende à un serveur.
// C'est ce qui le disqualifie : on ne veut pas d'un jeton Trello dans le
// bundle client, même le temps d'un aller-retour.
//
// Le jeton obtenu ici s'utilise ensuite comme un `key=…&token=…` ordinaire.
// C'est pour ça que `lib/trello.ts` n'a pas eu à changer : le protocole sert à
// OBTENIR le jeton, jamais à s'en servir.
//
// ── Les trois pièges de la signature ──
// Toute implémentation naïve échoue sur au moins l'un des trois, et Trello
// répond alors un 401 sans motif :
//   1. `encodeURIComponent` laisse passer ! ' ( ) * — la RFC 3986 les veut encodés ;
//   2. les paramètres se trient sur leur forme ENCODÉE, pas sur leur forme brute ;
//   3. la clé de signature est « secretConsommateur&secretToken », les DEUX
//      encodés, et l'esperluette est présente même quand le second est vide.

import crypto from "crypto";

const OAUTH_BASE = "https://trello.com/1";
const API_BASE = "https://api.trello.com/1";

/** Nom présenté à l'utilisateur sur l'écran d'autorisation Trello. */
const NOM_APP = "MyFlip";

/** Encodage percent conforme à la RFC 3986 §2.1. */
export function encoderRFC3986(valeur: string): string {
  return encodeURIComponent(valeur).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * Base de signature : METHODE&url&paramètres, chaque partie encodée.
 * Les paramètres sont triés par nom encodé, puis par valeur encodée.
 */
export function baseDeSignature(
  methode: string,
  url: string,
  params: Record<string, string>,
): string {
  const normalises = Object.entries(params)
    .map(([cle, valeur]) => [encoderRFC3986(cle), encoderRFC3986(valeur)])
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([cle, valeur]) => `${cle}=${valeur}`)
    .join("&");

  return [methode.toUpperCase(), encoderRFC3986(url), encoderRFC3986(normalises)].join(
    "&",
  );
}

/** HMAC-SHA1 en base64. `secretToken` est vide à l'étape du jeton de requête. */
export function signerHMAC(
  base: string,
  secretConsommateur: string,
  secretToken: string,
): string {
  const cle = `${encoderRFC3986(secretConsommateur)}&${encoderRFC3986(secretToken)}`;
  return crypto.createHmac("sha1", cle).update(base).digest("base64");
}

/**
 * En-tête `Authorization: OAuth …`, signature comprise.
 *
 * On signe et on transmet par en-tête plutôt que par paramètres de requête :
 * une signature en query string finit dans les journaux d'accès des proxies.
 */
export function enteteAuthorization(
  methode: string,
  url: string,
  params: Record<string, string>,
  secretConsommateur: string,
  secretToken = "",
): string {
  const signature = signerHMAC(
    baseDeSignature(methode, url, params),
    secretConsommateur,
    secretToken,
  );
  const tous = { ...params, oauth_signature: signature };
  const liste = Object.entries(tous)
    .map(([cle, valeur]) => `${encoderRFC3986(cle)}="${encoderRFC3986(valeur)}"`)
    .join(", ");
  return `OAuth ${liste}`;
}

/** Réponse Trello aux étapes OAuth : `application/x-www-form-urlencoded`. */
export function parserFormEncoded(corps: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [cle, valeur] of new URLSearchParams(corps).entries()) {
    out[cle] = valeur;
  }
  return out;
}

// ── Client OAuth ───────────────────────────────────────────────────────────

export type CoupleOAuth = { token: string; secret: string };

/**
 * Identifiants de l'APPLICATION MyFlip — pas ceux d'un utilisateur.
 *
 * `null` quand le déploiement n'est pas configuré : les appelants doivent
 * rendre « non-configure » plutôt que planter. Une application mal configurée
 * est un problème d'exploitation, pas une erreur de l'utilisateur.
 */
export function credentialsApp(): { key: string; secret: string } | null {
  const key = process.env.TRELLO_API_KEY?.trim();
  const secret = process.env.TRELLO_API_SECRET?.trim();
  return key && secret ? { key, secret } : null;
}

function paramsBase(key: string): Record<string, string> {
  return {
    oauth_consumer_key: key,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
}

/**
 * Appelle un endpoint OAuth de Trello et lit sa réponse form-encoded.
 *
 * Le corps d'erreur est repris dans l'exception : il ne contient jamais de
 * secret (la signature part en en-tête), seulement le motif du refus, qui est
 * la seule chose exploitable pour diagnostiquer un 401.
 */
async function appelOAuth(
  url: string,
  params: Record<string, string>,
  secretConsommateur: string,
  secretToken = "",
): Promise<Record<string, string>> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: enteteAuthorization(
        "POST",
        url,
        params,
        secretConsommateur,
        secretToken,
      ),
    },
    cache: "no-store",
  });
  const corps = await res.text();
  if (!res.ok) {
    throw new Error(`Trello OAuth ${res.status}: ${corps.slice(0, 200)}`);
  }
  return parserFormEncoded(corps);
}

/** Étape 1 : obtenir un jeton de requête, lié à notre URL de retour. */
export async function demanderRequestToken(callbackURL: string): Promise<CoupleOAuth> {
  const app = credentialsApp();
  if (!app) throw new Error("TRELLO_API_KEY / TRELLO_API_SECRET absentes.");

  const url = `${OAUTH_BASE}/OAuthGetRequestToken`;
  const reponse = await appelOAuth(
    url,
    { ...paramsBase(app.key), oauth_callback: callbackURL },
    app.secret,
  );

  const token = reponse.oauth_token;
  const secret = reponse.oauth_token_secret;
  if (!token || !secret) throw new Error("Trello n'a pas renvoyé de jeton de requête.");
  return { token, secret };
}

/**
 * Étape 2 : l'URL de l'écran d'autorisation.
 *
 * `scope=read,write` et rien de plus. `account` donnerait accès à l'identité et
 * aux informations du compte Trello, dont MyFlip n'a aucun usage — l'identité
 * affichée se lit avec `read` seul.
 */
export function urlAutorisation(requestToken: string): string {
  const params = new URLSearchParams({
    oauth_token: requestToken,
    name: NOM_APP,
    scope: "read,write",
    expiration: "never",
  });
  return `${OAUTH_BASE}/OAuthAuthorizeToken?${params}`;
}

/** Étape 3 : échanger le jeton de requête vérifié contre un jeton d'accès. */
export async function echangerAccessToken(
  requete: CoupleOAuth,
  verifier: string,
): Promise<CoupleOAuth> {
  const app = credentialsApp();
  if (!app) throw new Error("TRELLO_API_KEY / TRELLO_API_SECRET absentes.");

  const url = `${OAUTH_BASE}/OAuthGetAccessToken`;
  const reponse = await appelOAuth(
    url,
    { ...paramsBase(app.key), oauth_token: requete.token, oauth_verifier: verifier },
    app.secret,
    requete.secret,
  );

  const token = reponse.oauth_token;
  const secret = reponse.oauth_token_secret;
  if (!token || !secret) throw new Error("Trello n'a pas renvoyé de jeton d'accès.");
  return { token, secret };
}

/**
 * Révoque un jeton côté Trello.
 *
 * L'appelant doit effacer le jeton de sa base QUOI QU'IL ARRIVE, y compris si
 * cette fonction lève : un jeton qu'on ne stocke plus est inoffensif, un jeton
 * stocké qu'on croit révoqué ne l'est pas.
 */
export async function revoquerToken(key: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tokens/${token}?key=${key}&token=${token}`, {
    method: "DELETE",
    cache: "no-store",
  });
  // 404 = déjà révoqué : le résultat voulu est atteint.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Trello revoquerToken ${res.status}`);
  }
}

/** Identité du membre Trello, pour afficher « connecté en tant que … ». */
export async function identiteMembre(
  key: string,
  token: string,
): Promise<{ id: string; nom: string }> {
  const res = await fetch(
    `${API_BASE}/members/me?fields=id,fullName,username&key=${key}&token=${token}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`Trello identiteMembre ${res.status}`);
  const m = (await res.json()) as { id: string; fullName?: string; username?: string };
  return { id: m.id, nom: m.fullName || m.username || "compte Trello" };
}
