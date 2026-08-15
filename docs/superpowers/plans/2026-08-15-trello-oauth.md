# Connexion Trello par OAuth — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la saisie manuelle clé/token/secret Trello par un parcours de connexion OAuth 1.0a où l'utilisateur ne voit jamais un token, sans casser la synchronisation existante ni la connexion héritée d'Aramis.

**Architecture:** OAuth 1.0a implémenté avec le seul `crypto` de Node. Le protocole est isolé dans `lib/trelloOAuth.ts` ; le token obtenu s'utilise comme un `key=…&token=…` ordinaire, donc `lib/trello.ts` n'est pas touché. La cascade de `lib/settings.ts` devient « token OAuth → clés héritées du compte → rien », sans repli sur l'environnement.

**Tech Stack:** Next 15 (App Router), React 18, Prisma 6 / Neon PostgreSQL, NextAuth v5, Vitest, Tailwind. Aucune dépendance ajoutée.

**Spec:** `docs/superpowers/specs/2026-08-15-trello-oauth-design.md`

## Global Constraints

- **Réponses et libellés d'interface en français.** Code, noms de variables et messages de commit en anglais. Les noms de fonctions et de variables de ce dépôt sont en français (`resoudreReglages`, `contexteTrello`) : suivre l'existant.
- **Ne jamais lancer `npm run build`** si un `npm run dev` tourne : ça corrompt `.next`. Vérifier avec `npx tsc --noEmit`.
- **Migrations Prisma écrites à la main.** Jamais `prisma migrate dev` ni `prisma db push` : ils produisent un `DROP COLUMN "photosPretes"` et un `DROP COLUMN "geminiKey"`.
- **Aucune colonne supprimée** dans cette livraison. `trelloKey`, `trelloToken`, `trelloSecret` restent pour les connexions héritées.
- **Aucun secret en clair** : tout secret stocké passe par `chiffrer()` de `lib/crypto.ts`. Aucun secret dans un log, un DTO ou un message d'erreur.
- **Scope Trello demandé : `read,write`.** Jamais `account`.
- **`lib/trello.ts`, `lib/trelloSetup.ts` et `lib/trelloConstantes.ts` ne sont pas modifiés** (sauf la suppression du champ `boardDuCompte` du type consommé, tâche 4).
- **Tests** : Vitest ne couvre que la logique pure (`vitest.config.ts`) — pas de React, pas de fetch réseau, pas de DOM. Toute logique à tester doit être extraite en fonction pure.
- **Ne pas commiter ni pousser sans demande explicite d'Aramis.** Les étapes « Commit » de ce plan sont préparées mais ne s'exécutent que sur son feu vert.
- **Deux remotes git** : `origin` (compta-polos) et `alex` (myflip-Alex, **interdit**). Ne jamais pousser sur `alex`.

---

### Task 1: Signature OAuth 1.0a

Le cœur cryptographique. Rien d'autre ne peut être écrit tant que celle-ci n'est pas juste : une signature fausse donne un `401` opaque de Trello, impossible à diagnostiquer depuis les couches supérieures.

**Files:**
- Create: `lib/trelloOAuth.ts`
- Test: `lib/trelloOAuth.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `encoderRFC3986(valeur: string): string`
  - `baseDeSignature(methode: string, url: string, params: Record<string, string>): string`
  - `signerHMAC(base: string, secretConsommateur: string, secretToken: string): string`
  - `enteteAuthorization(methode: string, url: string, params: Record<string, string>, secretConsommateur: string, secretToken?: string): string`
  - `parserFormEncoded(corps: string): Record<string, string>`

- [ ] **Step 1: Write the failing test**

Vecteurs de la RFC 5849 §3.4.1.1 (l'exemple normatif), plus les cas d'encodage qui font échouer toutes les implémentations naïves.

```ts
// lib/trelloOAuth.test.ts
import { describe, expect, it } from "vitest";
import {
  baseDeSignature,
  encoderRFC3986,
  enteteAuthorization,
  parserFormEncoded,
  signerHMAC,
} from "@/lib/trelloOAuth";

describe("encoderRFC3986", () => {
  // `encodeURIComponent` laisse passer ! ' ( ) * — la RFC 3986 les veut encodés.
  it("encode les caractères que encodeURIComponent laisse passer", () => {
    expect(encoderRFC3986("!'()*")).toBe("%21%27%28%29%2A");
  });

  it("laisse les caractères non réservés intacts", () => {
    expect(encoderRFC3986("aA0-._~")).toBe("aA0-._~");
  });

  it("encode l'espace en %20 et non en +", () => {
    expect(encoderRFC3986("a b")).toBe("a%20b");
  });
});

describe("baseDeSignature", () => {
  // RFC 5849 §3.4.1.1, exemple normatif.
  it("reproduit la base de signature de la RFC 5849", () => {
    const base = baseDeSignature(
      "POST",
      "http://example.com/request",
      {
        b5: "=%3D",
        a3: "a",
        "c@": "",
        a2: "r b",
        oauth_consumer_key: "9djdj82h48djs9d2",
        oauth_token: "kkk9d7dh3k39sjv7",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "137131201",
        oauth_nonce: "7d8f3e4a",
      },
    );
    expect(base).toBe(
      "POST&http%3A%2F%2Fexample.com%2Frequest&a2%3Dr%2520b%26a3%3Da%26b5%3D%253D%25253D" +
        "%26c%2540%3D%26oauth_consumer_key%3D9djdj82h48djs9d2%26oauth_nonce%3D7d8f3e4a" +
        "%26oauth_signature_method%3DHMAC-SHA1%26oauth_timestamp%3D137131201" +
        "%26oauth_token%3Dkkk9d7dh3k39sjv7",
    );
  });

  it("trie les paramètres par nom encodé", () => {
    const base = baseDeSignature("GET", "https://x.test/y", { b: "2", a: "1" });
    expect(base).toBe("GET&https%3A%2F%2Fx.test%2Fy&a%3D1%26b%3D2");
  });
});

describe("signerHMAC", () => {
  // Valeurs de référence calculées indépendamment de l'implémentation :
  //   node -e "console.log(require('crypto').createHmac('sha1','cs&ts').update('base').digest('base64'))"
  // La clé est « secretConsommateur&secretToken », les deux encodés RFC 3986.
  it("signe avec la clé composée des deux secrets", () => {
    expect(signerHMAC("base", "cs", "ts")).toBe("yokOBuNxfx9mDhT9jfD68gmZoT8=");
  });

  it("garde l'esperluette quand le secret de token est vide (étape request token)", () => {
    // HMAC-SHA1 de « base » avec la clé « cs& » — l'esperluette est présente
    // même sans second secret. L'omettre est l'erreur classique.
    expect(signerHMAC("base", "cs", "")).toBe("4LIHXsZ//boYzSP4VoU8yJSHkUE=");
  });

  it("produit une signature différente quand le secret change", () => {
    expect(signerHMAC("base", "cs", "autre")).toBe("4A3r85rLX+Oza72CMYuZ2bxpT0Y=");
    expect(signerHMAC("base", "cs", "autre")).not.toBe(signerHMAC("base", "cs", "ts"));
  });
});

describe("enteteAuthorization", () => {
  it("liste les paramètres oauth_* entre guillemets, séparés par des virgules", () => {
    const entete = enteteAuthorization(
      "POST",
      "https://trello.com/1/OAuthGetRequestToken",
      {
        oauth_consumer_key: "cle",
        oauth_nonce: "abc",
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: "1",
        oauth_version: "1.0",
        oauth_callback: "https://app.test/api/trello/callback",
      },
      "secret",
    );
    expect(entete).toMatch(/^OAuth /);
    expect(entete).toContain('oauth_consumer_key="cle"');
    expect(entete).toContain('oauth_callback="https%3A%2F%2Fapp.test%2Fapi%2Ftrello%2Fcallback"');
    expect(entete).toMatch(/oauth_signature="[^"]+"/);
  });

  it("n'inclut jamais le secret dans l'en-tête", () => {
    const entete = enteteAuthorization(
      "POST",
      "https://trello.com/1/OAuthGetRequestToken",
      { oauth_consumer_key: "cle", oauth_nonce: "abc", oauth_signature_method: "HMAC-SHA1", oauth_timestamp: "1", oauth_version: "1.0" },
      "SECRET-TRES-SECRET",
    );
    expect(entete).not.toContain("SECRET-TRES-SECRET");
  });
});

describe("parserFormEncoded", () => {
  it("lit la réponse de Trello", () => {
    expect(
      parserFormEncoded("oauth_token=abc&oauth_token_secret=def&oauth_callback_confirmed=true"),
    ).toEqual({
      oauth_token: "abc",
      oauth_token_secret: "def",
      oauth_callback_confirmed: "true",
    });
  });

  it("décode les valeurs percent-encodées", () => {
    expect(parserFormEncoded("a=x%20y")).toEqual({ a: "x y" });
  });

  it("renvoie un objet vide sur un corps vide", () => {
    expect(parserFormEncoded("")).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/trelloOAuth.test.ts`
Expected: FAIL — « Failed to resolve import "@/lib/trelloOAuth" ».

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/trelloOAuth.ts
// Signature OAuth 1.0a (RFC 5849), la partie protocole.
//
// Écrite à la main plutôt qu'avec une bibliothèque : le protocole tient en
// quelques dizaines de lignes, et les paquets OAuth1 du registre traînent des
// dépendances transitives pour un algorithme qui n'a pas bougé depuis 2010.
//
// ⚠️ Les trois pièges qui font échouer toute implémentation naïve :
//   1. `encodeURIComponent` laisse passer ! ' ( ) * — la RFC les veut encodés ;
//   2. les paramètres se trient sur leur forme ENCODÉE, pas sur leur forme brute ;
//   3. la clé de signature est « secretConsommateur&secretToken », les DEUX
//      encodés, et l'esperluette est présente même quand le second est vide.

import crypto from "crypto";

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

  return [
    methode.toUpperCase(),
    encoderRFC3986(url),
    encoderRFC3986(normalises),
  ].join("&");
}

/** HMAC-SHA1 en base64. `secretToken` est vide à l'étape du request token. */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/trelloOAuth.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit (sur feu vert d'Aramis)**

```bash
git add lib/trelloOAuth.ts lib/trelloOAuth.test.ts
git commit -m "feat(trello): add OAuth 1.0a signature primitives"
```

---

### Task 2: Client OAuth Trello

Les trois appels du protocole, plus la révocation et la lecture d'identité. Séparée de la tâche 1 parce qu'elle fait du réseau : un reviewer peut accepter la signature et refuser la façon dont les erreurs Trello sont remontées.

**Files:**
- Modify: `lib/trelloOAuth.ts` (ajout, après les primitives)
- Create: `lib/trelloErreurs.ts`
- Test: `lib/trelloErreurs.test.ts`, `lib/trelloOAuth.test.ts` (ajouts)

**Interfaces:**
- Consumes: `enteteAuthorization`, `parserFormEncoded` (tâche 1).
- Produces:
  - `type CoupleOAuth = { token: string; secret: string }`
  - `credentialsApp(): { key: string; secret: string } | null`
  - `demanderRequestToken(callbackURL: string): Promise<CoupleOAuth>`
  - `urlAutorisation(requestToken: string): string`
  - `echangerAccessToken(requete: CoupleOAuth, verifier: string): Promise<CoupleOAuth>`
  - `revoquerToken(key: string, token: string): Promise<void>`
  - `identiteMembre(key: string, token: string): Promise<{ id: string; nom: string }>`
  - `type CodeErreurTrello` et `messageErreur(code: CodeErreurTrello): string` (dans `lib/trelloErreurs.ts`)
  - `codeDepuisStatut(statut: number): CodeErreurTrello`

- [ ] **Step 1: Write the failing test — messages d'erreur**

```ts
// lib/trelloErreurs.test.ts
import { describe, expect, it } from "vitest";
import { CODES_ERREUR, codeDepuisStatut, messageErreur } from "@/lib/trelloErreurs";

describe("messageErreur", () => {
  it("rend un message français pour chaque code", () => {
    for (const code of CODES_ERREUR) {
      const m = messageErreur(code);
      expect(m.length).toBeGreaterThan(10);
      expect(m).not.toMatch(/undefined|TODO/);
    }
  });

  it("annonce qu'aucun accès n'a été enregistré en cas de refus", () => {
    expect(messageErreur("refus")).toBe(
      "La connexion Trello a été refusée. Aucun accès n'a été enregistré.",
    );
  });

  it("invite à reconnecter quand le token n'est plus valide", () => {
    expect(messageErreur("token-invalide")).toBe(
      "Ta connexion Trello n'est plus valide. Reconnecte ton compte Trello.",
    );
  });

  it("retombe sur un message générique pour un code inconnu", () => {
    expect(messageErreur("code-qui-nexiste-pas" as never)).toBe(
      "La connexion à Trello a échoué. Réessaie dans un instant.",
    );
  });
});

describe("codeDepuisStatut", () => {
  it("traduit 401 en token invalide", () => {
    expect(codeDepuisStatut(401)).toBe("token-invalide");
  });

  it("traduit 404 en ressource absente", () => {
    expect(codeDepuisStatut(404)).toBe("introuvable");
  });

  it("traduit tout le reste en erreur d'API", () => {
    expect(codeDepuisStatut(500)).toBe("api");
    expect(codeDepuisStatut(429)).toBe("api");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/trelloErreurs.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write `lib/trelloErreurs.ts`**

```ts
// lib/trelloErreurs.ts
// Traduction des échecs Trello en phrases lisibles.
//
// Module sans dépendance : il est lu par le serveur (qui choisit le code) et
// par le navigateur (qui affiche la phrase). Les deux doivent voir la même
// liste — un code sans message afficherait une chaîne vide à l'utilisateur.

export const CODES_ERREUR = [
  "refus",
  "oauth",
  "callback-invalide",
  "demande-expiree",
  "token-invalide",
  "aucun-board",
  "aucune-etiquette",
  "board-supprime",
  "etiquette-supprimee",
  "introuvable",
  "api",
  "non-configure",
] as const;

export type CodeErreurTrello = (typeof CODES_ERREUR)[number];

const MESSAGES: Record<CodeErreurTrello, string> = {
  refus: "La connexion Trello a été refusée. Aucun accès n'a été enregistré.",
  oauth: "La connexion à Trello a échoué. Réessaie dans un instant.",
  "callback-invalide":
    "Ce retour de Trello ne correspond pas à ta demande de connexion. Relance la connexion.",
  "demande-expiree": "Ta demande de connexion a expiré. Relance-la.",
  "token-invalide":
    "Ta connexion Trello n'est plus valide. Reconnecte ton compte Trello.",
  "aucun-board":
    "Aucun tableau accessible avec ce compte Trello. Crée un tableau puis reviens ici.",
  "aucune-etiquette":
    "Ce tableau n'a aucune étiquette. Passe par « Préparer le board » pour les créer.",
  "board-supprime": "Le tableau surveillé n'existe plus. Choisis-en un autre.",
  "etiquette-supprimee":
    "Une des deux étiquettes n'existe plus sur ce tableau. Choisis-la à nouveau.",
  introuvable:
    "Trello ne trouve pas cette ressource. Le tableau ou l'étiquette a peut-être été supprimé.",
  api: "Trello n'a pas répondu correctement. Réessaie dans un instant.",
  "non-configure":
    "La connexion Trello n'est pas configurée sur ce déploiement. Préviens l'administrateur.",
};

export function messageErreur(code: CodeErreurTrello): string {
  return MESSAGES[code] ?? MESSAGES.oauth;
}

/** Statut HTTP renvoyé par l'API Trello → code d'erreur applicatif. */
export function codeDepuisStatut(statut: number): CodeErreurTrello {
  if (statut === 401) return "token-invalide";
  if (statut === 404) return "introuvable";
  return "api";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/trelloErreurs.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing test — URL d'autorisation**

Ajouter à `lib/trelloOAuth.test.ts` :

```ts
import { urlAutorisation } from "@/lib/trelloOAuth";

describe("urlAutorisation", () => {
  it("vise l'endpoint documenté avec le scope minimal", () => {
    const url = new URL(urlAutorisation("jeton-de-requete"));
    expect(url.origin + url.pathname).toBe("https://trello.com/1/OAuthAuthorizeToken");
    expect(url.searchParams.get("oauth_token")).toBe("jeton-de-requete");
    expect(url.searchParams.get("scope")).toBe("read,write");
    expect(url.searchParams.get("expiration")).toBe("never");
    expect(url.searchParams.get("name")).toBe("MyFlip");
  });

  it("ne demande jamais le scope account", () => {
    expect(urlAutorisation("x")).not.toContain("account");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run lib/trelloOAuth.test.ts`
Expected: FAIL — `urlAutorisation` n'est pas exportée.

- [ ] **Step 7: Ajouter le client à `lib/trelloOAuth.ts`**

```ts
// ── Client OAuth Trello ────────────────────────────────────────────────────
//
// Trello n'a PAS d'OAuth 2.0 sur son API REST (doc Atlassian, 15/08/2026). Le
// seul autre flux, `/1/authorize`, ne sait rendre le token que par fragment
// d'URL ou postMessage — donc au navigateur, ce qu'on refuse.
//
// Le token obtenu ici s'utilise ensuite comme un `key=…&token=…` ordinaire :
// c'est pour ça que `lib/trello.ts` n'a pas eu à changer.

const OAUTH_BASE = "https://trello.com/1";
const API_BASE = "https://api.trello.com/1";

/** Nom présenté à l'utilisateur sur l'écran d'autorisation Trello. */
const NOM_APP = "MyFlip";

export type CoupleOAuth = { token: string; secret: string };

/**
 * Identifiants de l'APPLICATION MyFlip — pas ceux d'un utilisateur.
 * `null` quand le déploiement n'est pas configuré : les appelants doivent
 * rendre « non-configure » plutôt que planter.
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
 * Le corps d'erreur est renvoyé tel quel dans l'exception : il ne contient
 * jamais de secret, seulement le motif du refus.
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
      Authorization: enteteAuthorization("POST", url, params, secretConsommateur, secretToken),
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
 * Étape 2 : l'écran d'autorisation.
 *
 * `scope=read,write` et rien de plus. `account` donnerait accès à l'identité
 * et aux informations de compte, dont MyFlip n'a aucun usage.
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
 * Best-effort : si Trello refuse (jeton déjà révoqué, réseau), l'appelant doit
 * quand même effacer le jeton de sa base. Un jeton qu'on ne stocke plus est
 * inoffensif ; un jeton stocké qu'on croit révoqué ne l'est pas.
 */
export async function revoquerToken(key: string, token: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tokens/${token}?key=${key}&token=${token}`, {
    method: "DELETE",
    cache: "no-store",
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`Trello revoquerToken ${res.status}`);
  }
}

/** Identité du membre Trello, pour afficher « connecté en tant que ». */
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run lib/trelloOAuth.test.ts lib/trelloErreurs.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit (sur feu vert)**

```bash
git add lib/trelloOAuth.ts lib/trelloOAuth.test.ts lib/trelloErreurs.ts lib/trelloErreurs.test.ts
git commit -m "feat(trello): add OAuth client and user-facing error catalog"
```

---

### Task 3: Migration de base

**Files:**
- Create: `prisma/migrations/20260815120000_trello_oauth/migration.sql`
- Modify: `prisma/schema.prisma:47-89` (modèle `UserSettings`)

**Interfaces:**
- Consumes: rien.
- Produces: les colonnes `trelloOauthToken`, `trelloOauthTokenSecret`, `trelloOauthRequestToken`, `trelloOauthRequestSecret`, `trelloOauthExpire`, `trelloMembreId`, `trelloMembreNom`, `trelloWebhookId` sur `UserSettings`.

- [ ] **Step 1: Écrire la migration SQL**

```sql
-- prisma/migrations/20260815120000_trello_oauth/migration.sql
-- Connexion Trello par OAuth 1.0a (15/08/2026).
--
-- ⚠️  MIGRATION ÉCRITE À LA MAIN — cf. l'en-tête de 20260808150000_user_settings.
--     `prisma migrate dev` produit un DROP COLUMN "photosPretes".
--
-- Contexte : l'utilisateur devait copier une clé d'API, un token et un secret
-- depuis trello.com/app-key. Il clique désormais sur « Connecter Trello » et
-- autorise MyFlip chez Trello ; le jeton ne passe jamais par le navigateur.
--
-- AUCUNE COLONNE N'EST SUPPRIMÉE. `trelloKey`, `trelloToken` et `trelloSecret`
-- portent les connexions héritées (celles saisies à la main avant cette date)
-- et restent lues tant qu'un compte en dépend.

ALTER TABLE "public"."UserSettings"
    -- Jeton d'accès de l'utilisateur, chiffré (AES-256-GCM, lib/crypto.ts).
    ADD COLUMN "trelloOauthToken"         TEXT,
    -- Secret du jeton d'accès, chiffré. Inutilisé aujourd'hui (les appels
    -- passent par key/token), conservé parce qu'il ne se récupère plus après
    -- coup et qu'il est indispensable si l'on doit signer les requêtes.
    ADD COLUMN "trelloOauthTokenSecret"   TEXT,

    -- Jeton de requête, éphémère : il ne vit qu'entre la redirection vers
    -- Trello et le retour. En clair — c'est un identifiant public, que Trello
    -- nous renvoie lui-même dans l'URL de callback.
    ADD COLUMN "trelloOauthRequestToken"  TEXT,
    -- Son secret, lui, est chiffré : il signe l'échange final.
    ADD COLUMN "trelloOauthRequestSecret" TEXT,
    -- Péremption du jeton de requête. C'est la protection CSRF : passé ce
    -- délai, un retour de Trello est refusé même si le jeton correspond.
    ADD COLUMN "trelloOauthExpire"        TIMESTAMP(3),

    -- Identité du compte Trello connecté, pour l'afficher (« connecté en tant
    -- que … »). Non secrète.
    ADD COLUMN "trelloMembreId"           TEXT,
    ADD COLUMN "trelloMembreNom"          TEXT,

    -- Webhook enregistré sur le board. Stocké pour pouvoir le SUPPRIMER à la
    -- déconnexion : un webhook orphelin continue de frapper l'application, et
    -- Trello finit par le désactiver au lieu de nous le signaler.
    ADD COLUMN "trelloWebhookId"          TEXT;
```

- [ ] **Step 2: Répercuter sur le schéma Prisma**

Dans `prisma/schema.prisma`, modèle `UserSettings`, après le bloc `trelloComptabiliseLabelId` :

```prisma
  // ── Connexion OAuth 1.0a (15/08/2026) ──
  // L'utilisateur ne saisit plus de clé : il autorise MyFlip chez Trello.
  // Le jeton est chiffré et ne quitte jamais le serveur.
  //
  // Les trois colonnes ci-dessus (trelloKey/Token/Secret) restent lues pour les
  // connexions HÉRITÉES — celles saisies à la main avant cette date. Même
  // consigne que `geminiKey` : ne pas les dropper.
  trelloOauthToken       String? @db.Text
  trelloOauthTokenSecret String? @db.Text

  // Éphémères : ils ne vivent qu'entre la redirection et le retour de Trello.
  // `trelloOauthRequestToken` est en clair (Trello nous le renvoie dans l'URL),
  // son secret est chiffré. `trelloOauthExpire` est la protection CSRF.
  trelloOauthRequestToken  String?
  trelloOauthRequestSecret String?  @db.Text
  trelloOauthExpire        DateTime?

  // Identité affichée dans l'écran de configuration.
  trelloMembreId  String?
  trelloMembreNom String?

  // Webhook du board, gardé pour pouvoir le supprimer à la déconnexion.
  trelloWebhookId String?
```

- [ ] **Step 3: Valider le schéma sans toucher la base**

Run: `npx prisma validate`
Expected: « The schema at prisma/schema.prisma is valid ».

- [ ] **Step 4: Appliquer la migration sur la base de développement**

⚠️ `.env` pointe sur la branche Neon `dev-multi-utilisateur` (`ep-autumn-morning`), **pas** sur la production. Vérifier avant :

Run: `grep -o 'ep-[a-z-]*' .env | head -1`
Expected: `ep-autumn-morning`

Puis :

Run: `npx prisma migrate deploy`
Expected: « 1 migration found », « Applied migration 20260815120000_trello_oauth ».

- [ ] **Step 5: Régénérer le client Prisma**

Run: `npx prisma generate`
Expected: « Generated Prisma Client ».

- [ ] **Step 6: Vérifier que les colonnes existent**

Run:
```bash
npx prisma db execute --stdin <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_name = 'UserSettings' AND column_name LIKE 'trello%'
ORDER BY column_name;
SQL
```
Expected: les 8 nouvelles colonnes plus les 6 anciennes.

- [ ] **Step 7: Commit (sur feu vert)**

```bash
git add prisma/schema.prisma prisma/migrations/20260815120000_trello_oauth
git commit -m "feat(trello): add OAuth token columns to UserSettings"
```

---

### Task 4: Cascade de résolution sans repli d'environnement

Le cœur de l'isolation. Cette tâche ferme le trou par lequel un utilisateur atteignait le board du propriétaire.

**Files:**
- Modify: `lib/settings.ts` (intégralement)
- Modify: `lib/types.ts:331-360` (DTO)
- Create: `lib/settings.test.ts`

**Interfaces:**
- Consumes: `credentialsApp` (tâche 2), les colonnes de la tâche 3.
- Produces:
  - `type SourceTrello = "oauth" | "heritee" | "absente"`
  - `type TrelloContexte = { key, token, secret: string | null, boardId, labelId, comptabiliseLabelId: string | null, source: "oauth" | "heritee" }` — **`boardDuCompte` est supprimé**
  - `contexteDepuisReglages(s: ReglagesTrelloBruts | null, app: { key, secret } | null): TrelloContexte | null` — **fonction pure, testable**
  - `resoudreReglages(userId)` et `contexteTrello(userId)` conservent leur signature
  - `utilisateurDuBoard(boardId)` conserve sa signature mais perd le repli sur `TRELLO_BOARD_ID`

- [ ] **Step 1: Write the failing test**

```ts
// lib/settings.test.ts
import { describe, expect, it } from "vitest";
import { contexteDepuisReglages, type ReglagesTrelloBruts } from "@/lib/settings";

const APP = { key: "cle-app", secret: "secret-app" };

// `contexteDepuisReglages` reçoit les secrets DÉJÀ DÉCHIFFRÉS : le
// déchiffrement dépend de process.env, qu'on ne veut pas dans un test pur.
const reglages = (over: Partial<ReglagesTrelloBruts> = {}): ReglagesTrelloBruts => ({
  oauthToken: null,
  heriteeKey: null,
  heriteeToken: null,
  heriteeSecret: null,
  boardId: null,
  labelId: null,
  comptabiliseLabelId: null,
  ...over,
});

describe("contexteDepuisReglages", () => {
  it("préfère le jeton OAuth et l'associe à la clé de l'application", () => {
    const ctx = contexteDepuisReglages(
      reglages({ oauthToken: "jeton-oauth", boardId: "b1", labelId: "l1" }),
      APP,
    );
    expect(ctx).toMatchObject({
      key: "cle-app",
      token: "jeton-oauth",
      secret: "secret-app",
      boardId: "b1",
      labelId: "l1",
      source: "oauth",
    });
  });

  it("retombe sur les clés héritées du compte quand il n'y a pas d'OAuth", () => {
    const ctx = contexteDepuisReglages(
      reglages({
        heriteeKey: "cle-perso",
        heriteeToken: "jeton-perso",
        heriteeSecret: "secret-perso",
        boardId: "b2",
      }),
      APP,
    );
    expect(ctx).toMatchObject({
      key: "cle-perso",
      token: "jeton-perso",
      secret: "secret-perso",
      source: "heritee",
    });
  });

  it("ignore une clé héritée sans son jeton : les deux vont ensemble", () => {
    expect(contexteDepuisReglages(reglages({ heriteeKey: "cle-perso" }), APP)).toBeNull();
    expect(contexteDepuisReglages(reglages({ heriteeToken: "jeton" }), APP)).toBeNull();
  });

  it("ne retombe JAMAIS sur les identifiants du déploiement", () => {
    // Le trou d'isolation d'avant le 15/08/2026 : un compte sans réglages
    // héritait de la clé, du jeton ET du board du propriétaire.
    expect(contexteDepuisReglages(reglages(), APP)).toBeNull();
    expect(contexteDepuisReglages(null, APP)).toBeNull();
  });

  it("rend null quand l'application n'est pas configurée mais que le compte a un OAuth", () => {
    // Un jeton OAuth sans la clé de l'app qui l'a émis est inutilisable.
    expect(contexteDepuisReglages(reglages({ oauthToken: "jeton" }), null)).toBeNull();
  });

  it("laisse passer une connexion héritée même sans configuration d'application", () => {
    const ctx = contexteDepuisReglages(
      reglages({ heriteeKey: "k", heriteeToken: "t" }),
      null,
    );
    expect(ctx?.source).toBe("heritee");
  });

  it("n'invente pas de board : sans board choisi, boardId reste null", () => {
    const ctx = contexteDepuisReglages(reglages({ oauthToken: "jeton" }), APP);
    expect(ctx?.boardId).toBeNull();
    expect(ctx?.labelId).toBeNull();
    expect(ctx?.comptabiliseLabelId).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/settings.test.ts`
Expected: FAIL — `contexteDepuisReglages` n'est pas exportée.

- [ ] **Step 3: Réécrire `lib/settings.ts`**

Remplacer le type `TrelloContexte` et la partie Trello de `resoudreReglages` :

```ts
/** D'où vient l'accès Trello réellement utilisé. */
export type SourceTrello = "oauth" | "heritee" | "absente";

/** Tout ce qu'il faut pour appeler l'API Trello au nom d'un utilisateur. */
export type TrelloContexte = {
  key: string;
  token: string;
  /** Secret d'API, uniquement pour valider la signature des webhooks entrants. */
  secret: string | null;
  boardId: string | null;
  labelId: string | null;
  comptabiliseLabelId: string | null;
  source: "oauth" | "heritee";
};

/**
 * Réglages Trello d'un compte, secrets DÉJÀ DÉCHIFFRÉS.
 *
 * Ce type existe pour que `contexteDepuisReglages` soit pure : le
 * déchiffrement lit `process.env`, la cascade non. C'est la cascade qu'on veut
 * pouvoir tester.
 */
export type ReglagesTrelloBruts = {
  oauthToken: string | null;
  heriteeKey: string | null;
  heriteeToken: string | null;
  heriteeSecret: string | null;
  boardId: string | null;
  labelId: string | null;
  comptabiliseLabelId: string | null;
};

/**
 * Cascade : jeton OAuth → clés héritées du compte → rien.
 *
 * ⚠️ IL N'Y A PLUS DE REPLI SUR L'ENVIRONNEMENT, et c'est le point de cette
 * fonction. Jusqu'au 15/08/2026, un compte sans réglages Trello retombait sur
 * `TRELLO_API_KEY` / `TRELLO_TOKEN` / `TRELLO_BOARD_ID` : n'importe quel
 * utilisateur lisait et écrivait sur le board du propriétaire du déploiement.
 * Ne pas réintroduire de repli ici sous prétexte de « faire marcher un compte
 * neuf » — un compte neuf doit se connecter, pas emprunter.
 */
export function contexteDepuisReglages(
  s: ReglagesTrelloBruts | null,
  app: { key: string; secret: string } | null,
): TrelloContexte | null {
  const ids = {
    boardId: vide(s?.boardId),
    labelId: vide(s?.labelId),
    comptabiliseLabelId: vide(s?.comptabiliseLabelId),
  };

  const oauth = vide(s?.oauthToken);
  if (oauth) {
    // Un jeton OAuth n'est utilisable qu'avec la clé de l'application qui l'a
    // émis : sans elle, il ne sert à rien de tenter l'appel.
    if (!app) return null;
    return { key: app.key, token: oauth, secret: app.secret, ...ids, source: "oauth" };
  }

  // Connexion héritée : clé ET jeton vont ensemble, ils forment un même accès.
  const key = vide(s?.heriteeKey);
  const token = vide(s?.heriteeToken);
  if (key && token) {
    return { key, token, secret: vide(s?.heriteeSecret), ...ids, source: "heritee" };
  }

  return null;
}
```

Puis, dans `resoudreReglages`, remplacer tout le bloc Trello (lignes 89-127 actuelles) par :

```ts
  const trello = contexteDepuisReglages(
    {
      oauthToken: dechiffrerOuNull(s?.trelloOauthToken),
      heriteeKey: dechiffrerOuNull(s?.trelloKey),
      heriteeToken: dechiffrerOuNull(s?.trelloToken),
      heriteeSecret: dechiffrerOuNull(s?.trelloSecret),
      boardId: s?.trelloBoardId ?? null,
      labelId: s?.trelloLabelId ?? null,
      comptabiliseLabelId: s?.trelloComptabiliseLabelId ?? null,
    },
    credentialsApp(),
  );
  const srcTrello: SourceTrello = trello?.source ?? "absente";
```

Et `utilisateurDuBoard` perd son repli :

```ts
/**
 * Retrouve l'utilisateur propriétaire d'un board Trello.
 *
 * C'est le routage du webhook entrant, qui n'a pas de session : il ne porte que
 * l'id du board. `UserSettings.trelloBoardId` est unique, donc la réponse est
 * sans ambiguïté.
 *
 * ⚠️ Plus de repli sur `TRELLO_BOARD_ID` + `TRELLO_OWNER_EMAIL` depuis le
 * 15/08/2026 : un board non rattaché à un compte est un board qu'on ignore.
 * Le compte historique a été migré en base par `scripts/migrer-trello-env.ts`.
 */
export async function utilisateurDuBoard(boardId: string): Promise<string | null> {
  const parReglages = await prisma.userSettings.findUnique({
    where: { trelloBoardId: boardId },
    select: { userId: true },
  });
  return parReglages?.userId ?? null;
}
```

Ne pas oublier l'import : `import { credentialsApp } from "@/lib/trelloOAuth";`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/settings.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Corriger les trois consommateurs de `boardDuCompte`**

Le champ n'existe plus. `npx tsc --noEmit` doit signaler exactement trois sites :

1. `app/api/user/settings/trello/route.ts:68` — remplacer `if (!ctx?.boardId || !ctx.boardDuCompte)` par `if (!ctx?.boardId)`.
2. `app/api/user/settings/trello/setup/route.ts:27` — même remplacement.
3. `scripts/setup-trello-webhook.ts` — retirer `boardDuCompte: true` et ajouter `source: "heritee" as const` à l'objet littéral.

Dans les deux routes, mettre à jour le commentaire : le garde-fou n'est plus nécessaire *parce que* la cascade ne retombe plus sur l'environnement — un `boardId` présent appartient forcément au compte.

- [ ] **Step 6: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 7: Lancer toute la suite**

Run: `npm test`
Expected: PASS, toutes les suites.

- [ ] **Step 8: Commit (sur feu vert)**

```bash
git add lib/settings.ts lib/settings.test.ts app/api/user/settings/trello scripts/setup-trello-webhook.ts
git commit -m "feat(trello): resolve credentials per account, drop deployment fallback"
```

---

### Task 5: Routes de connexion, de retour et de déconnexion

**Files:**
- Create: `app/api/trello/connect/route.ts`
- Create: `app/api/trello/callback/route.ts`
- Create: `app/api/trello/disconnect/route.ts`
- Create: `lib/trelloCallback.ts`
- Test: `lib/trelloCallback.test.ts`

**Interfaces:**
- Consumes: `demanderRequestToken`, `urlAutorisation`, `echangerAccessToken`, `revoquerToken`, `identiteMembre`, `credentialsApp` (tâche 2) ; `messageErreur`, `CodeErreurTrello` (tâche 2) ; `contexteTrello` (tâche 4) ; `chiffrer`, `dechiffrerOuNull` (existant) ; `origineDe` (existant).
- Produces:
  - `urlCallback(origine: string): string`
  - `origineAutorisee(origine: string, hoteApp: string | null): boolean`
  - `retourAvecCode(origine: string, chemin: string, code: CodeErreurTrello | "ok"): string`
  - Les trois routes HTTP.

- [ ] **Step 1: Write the failing test**

```ts
// lib/trelloCallback.test.ts
import { describe, expect, it } from "vitest";
import { origineAutorisee, retourAvecCode, urlCallback } from "@/lib/trelloCallback";

describe("urlCallback", () => {
  it("construit l'URL de retour depuis l'origine servie", () => {
    expect(urlCallback("https://myflip-app.vercel.app")).toBe(
      "https://myflip-app.vercel.app/api/trello/callback",
    );
  });

  it("supprime la barre oblique finale", () => {
    expect(urlCallback("https://x.test/")).toBe("https://x.test/api/trello/callback");
  });
});

describe("origineAutorisee", () => {
  it("accepte tout quand aucun hôte d'application n'est configuré", () => {
    expect(origineAutorisee("https://n-importe-quoi.test", null)).toBe(true);
  });

  it("accepte l'origine qui correspond à l'hôte configuré", () => {
    expect(origineAutorisee("https://app.myflip.fr", "app.myflip.fr")).toBe(true);
  });

  it("refuse une origine qui ne correspond pas", () => {
    expect(origineAutorisee("https://attaquant.test", "app.myflip.fr")).toBe(false);
  });

  it("ignore la casse et le port", () => {
    expect(origineAutorisee("https://APP.MyFlip.fr", "app.myflip.fr")).toBe(true);
  });

  it("accepte localhost en développement même avec un hôte configuré", () => {
    expect(origineAutorisee("http://localhost:3000", "app.myflip.fr")).toBe(true);
  });
});

describe("retourAvecCode", () => {
  it("marque le succès", () => {
    expect(retourAvecCode("https://x.test", "/compte", "ok")).toBe(
      "https://x.test/compte?trello=ok",
    );
  });

  it("transporte le code d'erreur", () => {
    expect(retourAvecCode("https://x.test", "/demarrage", "refus")).toBe(
      "https://x.test/demarrage?trello=refus",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/trelloCallback.test.ts`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Write `lib/trelloCallback.ts`**

```ts
// lib/trelloCallback.ts
// Construction et validation de l'URL de retour OAuth.
//
// Isolé de la route pour être testable : ce sont exactement les trois
// décisions qui, mal prises, ouvrent une redirection ouverte ou envoient
// l'utilisateur poser son cookie sur un domaine qu'il n'a pas demandé.

import type { CodeErreurTrello } from "@/lib/trelloErreurs";

const CHEMIN_CALLBACK = "/api/trello/callback";

/** URL que Trello appellera au retour. Déduite de l'origine RÉELLEMENT servie. */
export function urlCallback(origine: string): string {
  return `${origine.replace(/\/$/, "")}${CHEMIN_CALLBACK}`;
}

/**
 * L'origine servie est-elle une origine légitime de l'application ?
 *
 * Quand `NEXT_PUBLIC_APP_HOST` est configuré, la vitrine et l'application
 * vivent sur deux hôtes : une connexion Trello initiée depuis la vitrine
 * poserait le retour au mauvais endroit. `localhost` reste accepté, sinon le
 * développement local devient impossible dès que la séparation est configurée.
 */
export function origineAutorisee(origine: string, hoteApp: string | null): boolean {
  if (!hoteApp) return true;
  let hote: string;
  try {
    hote = new URL(origine).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hote === "localhost" || hote === "127.0.0.1") return true;
  return hote === hoteApp.toLowerCase();
}

/** Redirection de retour, avec le résultat de la tentative. */
export function retourAvecCode(
  origine: string,
  chemin: string,
  code: CodeErreurTrello | "ok",
): string {
  return `${origine.replace(/\/$/, "")}${chemin}?trello=${code}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/trelloCallback.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Écrire `app/api/trello/connect/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { chiffrer, chiffrementDisponible } from "@/lib/crypto";
import { HOTE_APP, origineDe } from "@/lib/hosts";
import { credentialsApp, demanderRequestToken, urlAutorisation } from "@/lib/trelloOAuth";
import { origineAutorisee, retourAvecCode, urlCallback } from "@/lib/trelloCallback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Durée de vie du jeton de requête. Au-delà, le retour de Trello est refusé. */
const VALIDITE_MINUTES = 10;

// GET /api/trello/connect — démarre l'autorisation.
//
// Route de NAVIGATION, pas d'API : elle répond par une redirection 302, parce
// que le navigateur doit atterrir sur l'écran d'autorisation de Trello. Les
// échecs repartent vers l'écran d'origine avec un code, jamais en JSON — un
// JSON s'afficherait tel quel dans la barre d'adresse.
export async function GET(req: NextRequest) {
  const origine = origineDe(req);
  const depuis = req.nextUrl.searchParams.get("depuis") === "demarrage" ? "/demarrage" : "/compte";
  const echec = (code: Parameters<typeof retourAvecCode>[2]) =>
    NextResponse.redirect(retourAvecCode(origine, depuis, code));

  const userId = await getUserId();
  if (!userId) return unauthorized();

  if (!origineAutorisee(origine, HOTE_APP)) {
    console.warn("[trello] connexion refusée : origine non autorisée");
    return echec("callback-invalide");
  }
  if (!credentialsApp()) return echec("non-configure");
  if (!chiffrementDisponible()) return echec("non-configure");

  try {
    const requete = await demanderRequestToken(urlCallback(origine));

    // Le jeton de requête est stocké LIÉ AU userId : c'est la protection CSRF.
    // Au retour, on refuse tout oauth_token qui n'est pas celui de la session.
    await prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        trelloOauthRequestToken: requete.token,
        trelloOauthRequestSecret: chiffrer(requete.secret),
        trelloOauthExpire: new Date(Date.now() + VALIDITE_MINUTES * 60_000),
      },
      update: {
        trelloOauthRequestToken: requete.token,
        trelloOauthRequestSecret: chiffrer(requete.secret),
        trelloOauthExpire: new Date(Date.now() + VALIDITE_MINUTES * 60_000),
      },
    });

    return NextResponse.redirect(urlAutorisation(requete.token));
  } catch (err) {
    // Le message peut contenir le corps de la réponse Trello ; il ne contient
    // jamais de secret (la signature part en en-tête, pas en query string).
    console.error("[trello] demande de jeton de requête échouée", err);
    return echec("oauth");
  }
}
```

- [ ] **Step 6: Écrire `app/api/trello/callback/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { chiffrer, dechiffrerOuNull } from "@/lib/crypto";
import { origineDe } from "@/lib/hosts";
import { credentialsApp, echangerAccessToken, identiteMembre } from "@/lib/trelloOAuth";
import { retourAvecCode } from "@/lib/trelloCallback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/trello/callback — retour de Trello après autorisation.
//
// Trois vérifications avant d'échanger quoi que ce soit :
//   1. la requête est authentifiée ;
//   2. l'oauth_token reçu est bien celui qu'on a stocké POUR CE COMPTE ;
//   3. il n'a pas expiré.
// La deuxième est la protection CSRF : sans elle, un tiers pourrait faire
// rattacher SON compte Trello à la session d'un autre utilisateur.
export async function GET(req: NextRequest) {
  const origine = origineDe(req);
  const depuis = req.nextUrl.searchParams.get("depuis") === "demarrage" ? "/demarrage" : "/compte";
  const retour = (code: Parameters<typeof retourAvecCode>[2]) =>
    NextResponse.redirect(retourAvecCode(origine, depuis, code));

  const userId = await getUserId();
  if (!userId) return unauthorized();

  const recu = req.nextUrl.searchParams.get("oauth_token");
  const verifier = req.nextUrl.searchParams.get("oauth_verifier");

  const s = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      trelloOauthRequestToken: true,
      trelloOauthRequestSecret: true,
      trelloOauthExpire: true,
    },
  });

  // Effacement systématique de l'éphémère, quel que soit l'issue : un jeton de
  // requête est à usage unique. Le garder ouvrirait une fenêtre de rejeu.
  const effacerEphemere = () =>
    prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
      },
    });

  // Refus de l'utilisateur : Trello renvoie sans oauth_verifier.
  if (!verifier) {
    if (s?.trelloOauthRequestToken) await effacerEphemere();
    return retour("refus");
  }

  if (!recu || !s?.trelloOauthRequestToken || recu !== s.trelloOauthRequestToken) {
    console.warn("[trello] callback rejeté : jeton de requête non concordant");
    if (s?.trelloOauthRequestToken) await effacerEphemere();
    return retour("callback-invalide");
  }

  if (!s.trelloOauthExpire || s.trelloOauthExpire.getTime() < Date.now()) {
    await effacerEphemere();
    return retour("demande-expiree");
  }

  const secretRequete = dechiffrerOuNull(s.trelloOauthRequestSecret);
  const app = credentialsApp();
  if (!secretRequete || !app) {
    await effacerEphemere();
    return retour(app ? "oauth" : "non-configure");
  }

  try {
    const acces = await echangerAccessToken({ token: recu, secret: secretRequete }, verifier);

    // L'identité sert uniquement à afficher « connecté en tant que … ». Son
    // échec ne doit pas perdre un jeton qu'on vient d'obtenir.
    let membre: { id: string; nom: string } | null = null;
    try {
      membre = await identiteMembre(app.key, acces.token);
    } catch (e) {
      console.error("[trello] lecture de l'identité du membre échouée", e);
    }

    await prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthToken: chiffrer(acces.token),
        trelloOauthTokenSecret: chiffrer(acces.secret),
        trelloMembreId: membre?.id ?? null,
        trelloMembreNom: membre?.nom ?? null,
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
      },
    });

    return retour("ok");
  } catch (err) {
    console.error("[trello] échange du jeton d'accès échoué", err);
    await effacerEphemere();
    return retour("oauth");
  }
}
```

- [ ] **Step 7: Écrire `app/api/trello/disconnect/route.ts`**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, unauthorized } from "@/lib/apiAuth";
import { contexteTrello } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const API = "https://api.trello.com/1";

// POST /api/trello/disconnect — révoque l'autorisation et efface tout.
//
// L'ordre compte : on supprime le webhook AVANT de révoquer le jeton, parce
// qu'un webhook appartient au jeton qui l'a créé — une fois le jeton révoqué,
// on ne peut plus le supprimer, et Trello continue de frapper l'application.
//
// Les deux appels à Trello sont best-effort : quoi qu'il arrive, les colonnes
// sont effacées. Un jeton qu'on ne stocke plus est inoffensif ; un jeton stocké
// qu'on croit révoqué ne l'est pas.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return unauthorized();

  try {
    const ctx = await contexteTrello(userId);
    const s = await prisma.userSettings.findUnique({
      where: { userId },
      select: { trelloWebhookId: true },
    });

    if (ctx && s?.trelloWebhookId) {
      try {
        const res = await fetch(
          `${API}/webhooks/${s.trelloWebhookId}?key=${ctx.key}&token=${ctx.token}`,
          { method: "DELETE", cache: "no-store" },
        );
        if (!res.ok && res.status !== 404) {
          console.warn(`[trello] suppression du webhook: ${res.status}`);
        }
      } catch (e) {
        console.error("[trello] suppression du webhook échouée", e);
      }
    }

    // Seule une connexion OAuth se révoque : un jeton hérité a été émis avec la
    // clé personnelle de l'utilisateur, il n'appartient pas à MyFlip.
    if (ctx?.source === "oauth") {
      try {
        const res = await fetch(
          `${API}/tokens/${ctx.token}?key=${ctx.key}&token=${ctx.token}`,
          { method: "DELETE", cache: "no-store" },
        );
        if (!res.ok && res.status !== 404) {
          console.warn(`[trello] révocation du jeton: ${res.status}`);
        }
      } catch (e) {
        console.error("[trello] révocation du jeton échouée", e);
      }
    }

    await prisma.userSettings.update({
      where: { userId },
      data: {
        trelloOauthToken: null,
        trelloOauthTokenSecret: null,
        trelloOauthRequestToken: null,
        trelloOauthRequestSecret: null,
        trelloOauthExpire: null,
        trelloMembreId: null,
        trelloMembreNom: null,
        trelloWebhookId: null,
        trelloBoardId: null,
        trelloLabelId: null,
        trelloComptabiliseLabelId: null,
        // La connexion héritée est effacée elle aussi : « Déconnecter Trello »
        // doit tout couper, pas basculer discrètement sur l'ancien accès.
        trelloKey: null,
        trelloToken: null,
        trelloSecret: null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/trello/disconnect", err);
    return NextResponse.json({ error: "Déconnexion impossible." }, { status: 500 });
  }
}
```

- [ ] **Step 8: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 9: Vérifier que le middleware ne bloque pas les routes**

`middleware.ts:8` exclut déjà `api` du matcher : les trois routes sont hors du middleware et se protègent elles-mêmes via `getUserId()`. Lire le fichier et le confirmer — aucune modification attendue.

- [ ] **Step 10: Commit (sur feu vert)**

```bash
git add app/api/trello lib/trelloCallback.ts lib/trelloCallback.test.ts
git commit -m "feat(trello): add connect, callback and disconnect routes"
```

---

### Task 6: Webhook automatique et source du secret de signature

**Files:**
- Modify: `app/api/user/settings/trello/route.ts` (POST : stocker `trelloWebhookId`, recréer si besoin)
- Modify: `app/api/user/settings/route.ts` (PUT : créer le webhook après enregistrement du board ; retirer `trelloKey`/`trelloToken`/`trelloSecret` des champs acceptés)
- Modify: `app/api/webhooks/trello/route.ts` (commentaire sur la source du secret)

**Interfaces:**
- Consumes: `contexteTrello` (tâche 4), `createWebhook` (`lib/trello.ts`, inchangé).
- Produces: `POST /api/user/settings/trello` renvoie `{ ok: true, webhookId: string | null, deja?: boolean }` et persiste `trelloWebhookId`.

- [ ] **Step 1: Faire persister l'id du webhook**

Dans `app/api/user/settings/trello/route.ts`, après l'appel à `createWebhook` :

```ts
    const webhook = (await createWebhook(
      ctx,
      `${base}/api/webhooks/trello`,
      ctx.boardId,
    )) as { id?: string };

    // L'id est conservé pour pouvoir SUPPRIMER le webhook à la déconnexion.
    // Sans lui, un compte déconnecté laisse derrière lui un webhook orphelin
    // qui continue de frapper l'application jusqu'à ce que Trello le désactive.
    if (webhook.id) {
      await prisma.userSettings.update({
        where: { userId },
        data: { trelloWebhookId: webhook.id },
      });
    }

    return NextResponse.json({ ok: true, webhookId: webhook.id ?? null });
```

Ajouter l'import `import { prisma } from "@/lib/prisma";`.

- [ ] **Step 2: Retirer les trois secrets Trello des champs acceptés**

Dans `app/api/user/settings/route.ts`, ligne 16-22, la constante `SECRETS` devient :

```ts
// Champs chiffrés, et le nom sous lequel le client les envoie.
//
// ⚠️ `trelloKey`, `trelloToken` et `trelloSecret` en ont été RETIRÉS le
// 15/08/2026 : l'accès Trello s'obtient par le parcours OAuth
// (/api/trello/connect), plus par saisie. Les colonnes existent toujours pour
// les connexions héritées, mais plus rien ne doit pouvoir les écrire — un
// formulaire qui les repose contournerait tout le contrôle d'autorisation.
const SECRETS = ["anthropicKey", "openrouterKey"] as const;
```

- [ ] **Step 3: Créer le webhook automatiquement à l'enregistrement du board**

Toujours dans `app/api/user/settings/route.ts`, juste avant le `return NextResponse.json({ ok: true })` du PUT :

```ts
    // Le board vient d'être choisi (ou changé) : Trello doit être prévenu de
    // nous prévenir. C'était un bouton séparé, que l'utilisateur pouvait ne
    // jamais cliquer — il se retrouvait configuré, sans rien qui remonte.
    //
    // Best-effort, comme toute la synchro Trello : l'échec est rapporté au
    // client mais n'annule jamais l'enregistrement des réglages.
    let webhook: string | null = null;
    if (typeof data.trelloBoardId === "string" && data.trelloBoardId) {
      webhook = await brancherWebhook(userId, origineDe(req));
    }

    return NextResponse.json({ ok: true, webhook });
```

Et, en haut du fichier, la fonction :

```ts
/**
 * Enregistre le webhook Trello sur le board du compte, si possible.
 *
 * Renvoie un message d'avertissement à afficher, ou `null` si tout va bien.
 * Ne lève jamais : la sauvegarde des réglages ne doit pas échouer parce que
 * Trello est indisponible.
 */
async function brancherWebhook(userId: string, origine: string): Promise<string | null> {
  const base = origine.replace(/\/$/, "");
  if (!base || base.includes("localhost")) {
    return "Réglages enregistrés. La connexion à Trello se fera depuis l'application en ligne : Trello ne sait pas appeler localhost.";
  }
  try {
    const ctx = await contexteTrello(userId);
    if (!ctx?.boardId) return null;
    const webhook = (await createWebhook(ctx, `${base}/api/webhooks/trello`, ctx.boardId)) as {
      id?: string;
    };
    if (webhook.id) {
      await prisma.userSettings.update({
        where: { userId },
        data: { trelloWebhookId: webhook.id },
      });
    }
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    // Trello renvoie 400 « A webhook with that callback, model, and token
    // already exists » quand la connexion est déjà en place : ce n'est pas un
    // échec du point de vue de l'utilisateur.
    if (/already exists/i.test(message)) return null;
    console.error("[trello] création automatique du webhook échouée", err);
    return "Réglages enregistrés, mais Trello n'a pas pu être branché. Utilise « Réparer la connexion ».";
  }
}
```

Imports à ajouter : `import { contexteTrello, reglagesBruts, resoudreReglages } from "@/lib/settings";` (compléter l'existant), `import { createWebhook } from "@/lib/trello";`, `import { origineDe } from "@/lib/hosts";`.

- [ ] **Step 4: Documenter la source du secret dans le webhook**

Dans `app/api/webhooks/trello/route.ts`, compléter le commentaire de `signatureValide` :

```ts
/**
 * Valide la signature `x-trello-webhook` : HMAC-SHA1, en base64, du corps brut
 * concaténé à l'URL de rappel.
 *
 * Le secret vient de la CONNEXION, pas du compte : `TRELLO_API_SECRET` (celui
 * de l'application) pour une connexion OAuth, `UserSettings.trelloSecret` pour
 * une connexion héritée. C'est `contexteDepuisReglages` qui tranche, cf.
 * `lib/settings.ts` — rien à faire ici.
 *
 * L'endpoint est public et route vers un compte d'après l'id du board : sans
 * cette vérification, une requête forgée ferait basculer les articles d'un
 * utilisateur en « À comptabiliser ».
 *
 * Faute de secret configuré, on laisse passer — sinon la synchro s'arrêterait
 * du jour au lendemain pour un board déjà en place. Le défaut est journalisé.
 */
```

Aucun changement de code dans ce fichier : `ctx.secret` porte déjà la bonne valeur grâce à la tâche 4.

- [ ] **Step 5: Vérifier la compilation et les tests**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur, toutes les suites passent.

- [ ] **Step 6: Commit (sur feu vert)**

```bash
git add app/api/user/settings app/api/webhooks/trello
git commit -m "feat(trello): register webhook automatically, stop accepting pasted credentials"
```

---

### Task 7: Interface de connexion

**Files:**
- Modify: `components/compte/Integrations.tsx` (module Trello réécrit, module IA inchangé)
- Modify: `lib/types.ts:334-360` (`UserSettingsDTO`)
- Modify: `app/api/user/settings/route.ts` (GET : nouveau DTO)

**Interfaces:**
- Consumes: `messageErreur`, `CodeErreurTrello` (tâche 2).
- Produces: `UserSettingsDTO.trello: { connecte: boolean; source: SourceTrello; membreNom: string | null; boardId: string | null; labelId: string | null; comptabiliseLabelId: string | null; webhookActif: boolean }`

- [ ] **Step 1: Redéfinir le DTO dans `lib/types.ts`**

Remplacer les champs `trelloKey`, `trelloToken`, `trelloSecret`, `trelloBoardId`, `trelloLabelId`, `trelloComptabiliseLabelId` de `UserSettingsDTO` par :

```ts
/** D'où vient l'accès Trello du compte. */
export type SourceTrello = "oauth" | "heritee" | "absente";

/**
 * État de la connexion Trello, vu du client.
 *
 * Aucun jeton ici, ni même son aperçu : contrairement aux clés IA, l'accès
 * Trello n'est jamais saisi par l'utilisateur, donc il n'a rien à y
 * reconnaître. Ce qu'il veut savoir, c'est « suis-je connecté, et à quel
 * compte ».
 */
export type TrelloEtatDTO = {
  connecte: boolean;
  source: SourceTrello;
  /** Nom du membre Trello, pour « connecté en tant que … ». */
  membreNom: string | null;
  boardId: string | null;
  labelId: string | null;
  comptabiliseLabelId: string | null;
  /** Vrai si un webhook est enregistré : sinon rien ne remonte de Trello. */
  webhookActif: boolean;
};
```

Puis dans `UserSettingsDTO` : remplacer les six champs par `trello: TrelloEtatDTO;` et, dans `source`, remplacer `trello: SourceReglage` par `trello: SourceTrello`.

- [ ] **Step 2: Adapter le GET de `app/api/user/settings/route.ts`**

```ts
    const dto: UserSettingsDTO = {
      anthropic: etatSecret(s?.anthropicKey),
      openrouter: etatSecret(s?.openrouterKey),
      trello: {
        connecte: resolus.trello !== null,
        source: resolus.trello?.source ?? "absente",
        membreNom: s?.trelloMembreNom ?? null,
        boardId: s?.trelloBoardId ?? null,
        labelId: s?.trelloLabelId ?? null,
        comptabiliseLabelId: s?.trelloComptabiliseLabelId ?? null,
        webhookActif: Boolean(s?.trelloWebhookId),
      },
      modeleIA: s?.modeleIA ?? null,
      objectifMensuel: s?.objectifMensuel ?? null,
      onboardingEtape: s?.onboardingEtape ?? 1,
      onboardingTermine: s?.onboardingTermine ?? false,
      source: {
        anthropic: resolus.source.anthropic,
        openrouter: resolus.source.openrouter,
        trello: resolus.source.trello,
      },
      chiffrementDisponible: chiffrementDisponible(),
    };
```

- [ ] **Step 3: Réécrire le module Trello de `components/compte/Integrations.tsx`**

Supprimer les états `trelloKey`, `trelloToken`, `trelloSecret` et leurs trois `<ChampSecret>`. Le composant `ChampSecret` reste : il sert encore aux deux clés IA. Le composant `ChampChoix` reste inchangé.

Ajouter, après les états Trello existants :

```tsx
  // Résultat de la tentative de connexion, transporté dans l'URL par
  // /api/trello/callback. Lu une fois puis effacé de la barre d'adresse :
  // recharger la page ne doit pas rejouer le message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("trello");
    if (!code) return;
    if (code === "ok") toast.success("Trello est connecté.");
    else toast.error(messageErreur(code as CodeErreurTrello));
    params.delete("trello");
    const reste = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (reste ? `?${reste}` : ""),
    );
  }, []);

  async function deconnecter() {
    if (
      !window.confirm(
        "Déconnecter Trello ? MyFlip ne recevra plus rien de ton tableau, et l'autorisation sera révoquée chez Trello.",
      )
    )
      return;
    setEnCours(true);
    try {
      const res = await fetch("/api/trello/disconnect", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Déconnexion impossible.");
        return;
      }
      toast.success("Trello déconnecté.");
      setBoards(null);
      setLabels(null);
      setBoardId("");
      setLabelId("");
      setComptaLabelId("");
      await charger();
    } finally {
      setEnCours(false);
    }
  }
```

Le corps du module devient :

```tsx
      {/* Trello */}
      <Module className="p-[24px]">
        <div className="mb-[14px] flex items-center gap-2.5">
          <SquareKanban className="h-[18px] w-[18px] text-[var(--acc)]" strokeWidth={2} />
          <CardTitle>Mon Trello</CardTitle>
        </div>

        {!dto.trello.connecte ? (
          <>
            <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--faint)]">
              Trello n&apos;est pas connecté. Une fois branché, poser
              l&apos;étiquette « À comptabiliser » sur une carte fait basculer
              les articles dont le SKU figure dans son titre — c&apos;est ce qui
              alimente ta page À comptabiliser.
            </p>
            <a href="/api/trello/connect" className={boutonCls}>
              Connecter Trello
            </a>
            <p className="mt-3 text-[12px] leading-snug text-[var(--faint)]">
              Tu seras redirigé vers Trello pour autoriser MyFlip à lire tes
              tableaux et à modifier tes cartes. Aucune clé à recopier.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-[var(--surface-2)] px-3.5 py-3">
              <span className="text-[13px] text-[var(--ink2)]">
                ✓ Trello connecté
                {dto.trello.membreNom ? ` — ${dto.trello.membreNom}` : ""}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
                {dto.trello.source === "heritee" ? "Connexion par clés API" : "Connexion Trello"}
              </span>
            </div>

            {dto.trello.source === "heritee" && (
              <div className="rounded-[16px] border border-[var(--border)] p-3.5">
                <p className="mb-2.5 text-[12.5px] leading-snug text-[var(--faint)]">
                  Cette connexion utilise une clé d&apos;API saisie à la main.
                  Elle continue de fonctionner ; la connexion Trello se révoque
                  d&apos;un clic et ne dépend d&apos;aucune clé à recopier.
                </p>
                <a href="/api/trello/connect" className={boutonSecondaireCls}>
                  Passer à la connexion Trello
                </a>
              </div>
            )}

            {!dto.trello.webhookActif && dto.trello.boardId && (
              <p role="alert" className="text-[12.5px] leading-snug text-[var(--warn)]">
                Aucun webhook enregistré : rien ne remonte de Trello pour
                l&apos;instant. Réenregistre ton board pour le rebrancher.
              </p>
            )}

            <ChampChoix
              id="board"
              titre="Board surveillé"
              valeur={boardId}
              onChange={(v) => {
                setBoardId(v);
                setLabels(null);
                chargerLabels(v);
              }}
              options={boards}
              placeholder="Identifiant du board"
              aide={
                boards
                  ? "Le tableau que MyFlip surveille."
                  : "Clique sur « Recharger mes boards » pour choisir dans une liste."
              }
            />

            <ChampChoix
              id="label-compta"
              titre="Étiquette « À comptabiliser »"
              valeur={labelId}
              onChange={setLabelId}
              options={optionsEtiquettes}
              placeholder="Identifiant de l'étiquette"
              aide="Quand tu la poses sur une carte, les articles dont le SKU figure dans le titre passent en « À comptabiliser »."
            />

            <ChampChoix
              id="label-comptabilise"
              titre="Étiquette « Comptabilisé »"
              valeur={comptaLabelId}
              onChange={setComptaLabelId}
              options={optionsEtiquettes}
              placeholder="Identifiant de l'étiquette"
              aide="MyFlip la pose lui-même sur la carte quand tu valides la vente."
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={enCours}
                onClick={() =>
                  enregistrer({
                    trelloBoardId: boardId || null,
                    trelloLabelId: labelId || null,
                    trelloComptabiliseLabelId: comptaLabelId || null,
                  })
                }
                className={boutonCls}
              >
                Enregistrer
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={chargerBoards}
                className={boutonSecondaireCls}
              >
                Recharger mes boards
              </button>
              <button
                type="button"
                disabled={enCours}
                onClick={deconnecter}
                className={`${boutonSecondaireCls} text-[var(--neg)]`}
              >
                Déconnecter Trello
              </button>
            </div>
          </div>
        )}
      </Module>
```

Adapter aussi `charger()` : les champs viennent maintenant de `json.trello.*`.

- [ ] **Step 4: Charger les boards automatiquement quand on est connecté**

Le bouton « Tester et lister mes boards » n'a plus de raison d'être à l'ouverture : la connexion est établie, la liste peut être chargée seule.

```tsx
  // Les boards se chargent seuls dès qu'on est connecté. Avant l'OAuth, il
  // fallait cliquer pour valider les clés saisies ; il n'y a plus de clé à
  // valider. Le bouton subsiste pour rafraîchir après création d'un tableau.
  const boardsCharges = useRef(false);
  useEffect(() => {
    if (!dto?.trello.connecte || boardsCharges.current) return;
    boardsCharges.current = true;
    chargerBoards();
  }, [dto?.trello.connecte, chargerBoards]);
```

`chargerBoards` doit être enveloppée dans `useCallback` pour être stable, et ne plus afficher de toast de succès au chargement automatique (ajouter un paramètre `silencieux = false`).

- [ ] **Step 5: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur. Si `app/demarrage/page.tsx` casse sur `dto.trelloBoardId`, c'est attendu : corrigé en tâche 8.

- [ ] **Step 6: Commit (sur feu vert)**

```bash
git add components/compte/Integrations.tsx lib/types.ts app/api/user/settings/route.ts
git commit -m "feat(trello): replace credential fields with connect/disconnect UI"
```

---

### Task 8: Parcours de démarrage à trois étapes

**Files:**
- Modify: `app/demarrage/page.tsx`
- Modify: `app/api/user/settings/route.ts:128-134` (borne de `onboardingEtape`)
- Modify: `components/DemarrageCard.tsx:16` (libellé de l'étape)

**Interfaces:**
- Consumes: `UserSettingsDTO.trello` (tâche 7).
- Produces: rien pour les tâches suivantes.

- [ ] **Step 1: Ramener la borne de 4 à 3**

Dans `app/api/user/settings/route.ts` :

```ts
    if ("onboardingEtape" in body) {
      const n = Number(body.onboardingEtape);
      // Borné : une étape hors plage bloquerait le parcours sur un écran vide.
      // Le parcours est passé de 4 à 3 étapes le 15/08/2026 (le webhook se
      // crée tout seul) : une valeur 4 déjà en base retombe donc sur 3.
      data.onboardingEtape = Number.isInteger(n) ? Math.min(Math.max(n, 1), 3) : 1;
    }
```

- [ ] **Step 2: Récrire les étapes de `app/demarrage/page.tsx`**

```tsx
const ETAPES = [
  { n: 1, titre: "Connecter ton Trello", resume: "Autorisation et board" },
  { n: 2, titre: "Préparer le board", resume: "Colonnes et étiquettes" },
  { n: 3, titre: "Ta première commande", resume: "Et c'est parti" },
];
```

Dans `charger()`, écrêter l'étape lue : `setEtape(Math.min(json.onboardingEtape, 3));`

- [ ] **Step 3: Remplacer le contenu de l'étape 1**

Le lien vers `trello.com/app-key` disparaît — il n'y a plus rien à y chercher.

```tsx
        {etape === 1 && (
          <>
            <Module className="p-[24px]">
              <CardTitle className="mb-2">Connecter ton Trello</CardTitle>
              <p className="mb-4 text-[13.5px] leading-relaxed text-[var(--muted)]">
                MyFlip lit ton tableau Trello pour savoir quand un article part
                en comptabilité. Un clic, tu autorises MyFlip chez Trello, et tu
                choisis ton tableau. Rien à recopier.
              </p>
            </Module>

            {/* Le même écran que /compte, plutôt qu'un formulaire jumeau qui
                divergerait à la première évolution. */}
            <Integrations />

            <Module className="p-[18px]">
              <button
                type="button"
                disabled={!trelloPret}
                onClick={() => enregistrerEtape(2)}
                className={boutonCls}
              >
                {trelloPret ? "Mon board est choisi, continuer" : "Connecte Trello et choisis ton board"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </Module>
          </>
        )}
```

- [ ] **Step 4: Supprimer l'ancienne étape 3 et renuméroter la dernière**

Supprimer entièrement le bloc `{etape === 3 && …}` (« Recevoir les événements ») et la fonction `connecterWebhook`. L'ancien bloc `{etape === 4 && …}` (« Ta première commande ») devient `{etape === 3 && …}`, et ses deux `enregistrerEtape(4, true)` deviennent `enregistrerEtape(3, true)`.

Dans l'étape « Préparer le board », le bouton de fin passe de `enregistrerEtape(3)` à `enregistrerEtape(3)` — inchangé, il vise déjà la dernière étape.

- [ ] **Step 5: Adapter les lectures du DTO**

`trelloPret` et `etiquettesPretes` lisent maintenant `dto.trello` :

```tsx
  const trelloPret = Boolean(dto.trello.connecte && dto.trello.boardId);
  const etiquettesPretes = Boolean(dto.trello.labelId && dto.trello.comptabiliseLabelId);
```

- [ ] **Step 6: Mettre à jour le libellé de la carte du dashboard**

`components/DemarrageCard.tsx:16` : `"Connecter ton Trello"` reste juste, mais la liste des étapes doit perdre son quatrième élément si elle en a un. Lire le fichier et aligner sur les trois étapes.

- [ ] **Step 7: Vérifier la compilation et les tests**

Run: `npx tsc --noEmit && npm test`
Expected: aucune erreur.

- [ ] **Step 8: Commit (sur feu vert)**

```bash
git add app/demarrage/page.tsx app/api/user/settings/route.ts components/DemarrageCard.tsx
git commit -m "feat(trello): shorten onboarding to three steps"
```

---

### Task 9: Migration des identifiants d'environnement vers le compte

Sans cette tâche, supprimer le repli déconnecte Aramis : sa connexion vit dans les variables d'environnement, pas en base.

**Files:**
- Create: `scripts/migrer-trello-env.ts`
- Modify: `package.json` (script npm)

**Interfaces:**
- Consumes: `chiffrer` (`lib/crypto.ts`).
- Produces: `npm run migrer-trello`.

- [ ] **Step 1: Écrire le script**

```ts
// scripts/migrer-trello-env.ts
//
// Recopie dans la base l'accès Trello qui vivait dans les variables
// d'environnement du déploiement.
//
// Pourquoi : jusqu'au 15/08/2026, un compte sans réglages Trello retombait sur
// TRELLO_API_KEY / TRELLO_TOKEN / TRELLO_BOARD_ID. Ce repli est supprimé —
// c'est par lui qu'un utilisateur atteignait le board du propriétaire. Le
// compte historique n'ayant jamais rien saisi dans /compte, il perdrait sa
// connexion : ce script la lui donne, cette fois attachée à SON compte.
//
// IDEMPOTENT : un compte qui a déjà une connexion (OAuth ou héritée) n'est pas
// touché. Relancer ne fait rien.
//
//   npm run migrer-trello           # montre ce qui serait fait
//   npm run migrer-trello -- --ecrire   # écrit
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { chiffrer, chiffrementDisponible } from "../lib/crypto";

loadEnvConfig(process.cwd());

const prisma = new PrismaClient();
const vide = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

async function main() {
  const ecrire = process.argv.includes("--ecrire");

  if (!chiffrementDisponible()) {
    throw new Error("ENCRYPTION_KEY absente ou invalide : impossible de chiffrer.");
  }

  const key = vide(process.env.TRELLO_API_KEY);
  const token = vide(process.env.TRELLO_TOKEN);
  if (!key || !token) {
    console.log("TRELLO_API_KEY / TRELLO_TOKEN absentes : rien à migrer.");
    return;
  }

  // Le propriétaire est celui que désignait l'ancien repli du webhook.
  const email = vide(process.env.TRELLO_OWNER_EMAIL);
  const proprietaire = email
    ? await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
    : await prisma.user.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, email: true },
      });

  if (!proprietaire) {
    throw new Error("Aucun compte propriétaire trouvé (TRELLO_OWNER_EMAIL introuvable ?).");
  }

  const existant = await prisma.userSettings.findUnique({
    where: { userId: proprietaire.id },
    select: { trelloOauthToken: true, trelloKey: true, trelloToken: true },
  });

  if (existant?.trelloOauthToken || (existant?.trelloKey && existant?.trelloToken)) {
    console.log(`${proprietaire.email} a déjà une connexion Trello — rien à faire.`);
    return;
  }

  const donnees = {
    trelloKey: chiffrer(key),
    trelloToken: chiffrer(token),
    ...(vide(process.env.TRELLO_SECRET) ? { trelloSecret: chiffrer(process.env.TRELLO_SECRET!) } : {}),
    ...(vide(process.env.TRELLO_BOARD_ID) ? { trelloBoardId: vide(process.env.TRELLO_BOARD_ID) } : {}),
    ...(vide(process.env.TRELLO_LABEL_ID) ? { trelloLabelId: vide(process.env.TRELLO_LABEL_ID) } : {}),
    ...(vide(process.env.TRELLO_COMPTABILISE_LABEL_ID)
      ? { trelloComptabiliseLabelId: vide(process.env.TRELLO_COMPTABILISE_LABEL_ID) }
      : {}),
  };

  // Journal volontairement muet sur les valeurs : on dit CE QU'ON POSE, jamais
  // ce que ça vaut.
  console.log(`Compte visé : ${proprietaire.email}`);
  console.log(`Champs à poser : ${Object.keys(donnees).join(", ")}`);

  if (!ecrire) {
    console.log("\nSimulation. Relancer avec --ecrire pour appliquer.");
    return;
  }

  await prisma.userSettings.upsert({
    where: { userId: proprietaire.id },
    create: { userId: proprietaire.id, ...donnees },
    update: donnees,
  });
  console.log("✅ Migration appliquée.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Ajouter le script npm**

Dans `package.json`, section `scripts` :

```json
    "migrer-trello": "tsx scripts/migrer-trello-env.ts",
```

- [ ] **Step 3: Vérifier l'endpoint de base avant toute exécution**

Run: `grep -o 'ep-[a-z-]*' .env | head -1`
Expected: `ep-autumn-morning` (dev). **Ne jamais lancer `--ecrire` en croyant viser la dev alors que `.env` pointe la prod.**

- [ ] **Step 4: Simulation sur la base de développement**

Run: `npm run migrer-trello`
Expected: affiche le compte visé et la liste des champs, puis « Simulation ».

- [ ] **Step 5: Vérifier l'idempotence**

Run: `npm run migrer-trello -- --ecrire && npm run migrer-trello -- --ecrire`
Expected: la première applique, la seconde affiche « a déjà une connexion Trello — rien à faire ».

- [ ] **Step 6: Commit (sur feu vert)**

```bash
git add scripts/migrer-trello-env.ts package.json
git commit -m "chore(trello): add one-shot migration from env credentials to account"
```

---

### Task 10: Documentation et variables d'environnement

**Files:**
- Modify: `.env.local.example`
- Modify: `CLAUDE.md` (sections « Intégration Trello », « Variables d'environnement requises », « API Routes »)
- Modify: `README.md` (mentions Trello)

**Interfaces:**
- Consumes: tout.
- Produces: rien.

- [ ] **Step 1: Réécrire la section Trello de `.env.local.example`**

```
# ── Intégration Trello ──
# MyFlip est une APPLICATION Trello : les utilisateurs cliquent sur
# « Connecter Trello » et autorisent MyFlip. Ils ne saisissent jamais de clé.
#
# Les deux valeurs ci-dessous sont celles de l'application, pas d'un
# utilisateur. Elles se récupèrent sur https://trello.com/power-ups/admin,
# onglet « API key » du Power-Up : « API key » et « OAuth Secret ».
TRELLO_API_KEY=
TRELLO_API_SECRET=     # signe les requêtes OAuth ET valide la signature des webhooks

# ── Reliquats de l'ancienne configuration (avant le 15/08/2026) ──
# Elles ne sont plus lues par l'application. `scripts/migrer-trello-env.ts` les
# lit une dernière fois pour recopier la connexion du propriétaire dans son
# compte, puis elles peuvent être supprimées du déploiement.
# TRELLO_TOKEN=
# TRELLO_SECRET=
# TRELLO_BOARD_ID=
# TRELLO_LABEL_ID=
# TRELLO_COMPTABILISE_LABEL_ID=
# TRELLO_OWNER_EMAIL=
```

Retirer aussi `GEMINI_API_KEY` de la section IA (elle n'est plus lue depuis le 13/08) et ajouter `OPENROUTER_API_KEY`, absente du fichier d'exemple.

- [ ] **Step 2: Réécrire la section « 🔗 Intégration Trello » de `CLAUDE.md`**

Remplacer le premier paragraphe (« ⚠️ Depuis le lot 3… ») par :

```markdown
⚠️ **Depuis le 15/08/2026, l'accès Trello s'obtient par OAuth 1.0a.** L'utilisateur
clique sur « Connecter Trello » (`/api/trello/connect`), autorise MyFlip chez Trello,
et revient sur `/api/trello/callback`. Le jeton est chiffré dans
`UserSettings.trelloOauthToken` et **ne transite jamais par le navigateur**.

Trello n'a pas d'OAuth 2.0 sur son API REST. Le seul autre flux, `/1/authorize`, ne
sait rendre le jeton qu'au navigateur (fragment d'URL ou `postMessage`) — c'est
pourquoi il a été écarté. Le protocole vit dans `lib/trelloOAuth.ts` ; le jeton
obtenu s'utilise comme un `key=…&token=…` ordinaire, donc `lib/trello.ts` n'a pas
bougé.

**Cascade de résolution** (`lib/settings.ts`, `contexteDepuisReglages`) :
jeton OAuth → clés héritées du compte → **rien**. Il n'y a plus de repli sur
les variables d'environnement : c'est par lui qu'un utilisateur atteignait le
board du propriétaire du déploiement. Ne pas le réintroduire.

Les « connexions héritées » sont les clé+token saisis à la main avant cette date.
Elles restent lues ; les colonnes `trelloKey`/`trelloToken`/`trelloSecret` ne
doivent pas être supprimées tant qu'un compte en dépend.

Le secret de signature du webhook suit la connexion : `TRELLO_API_SECRET` (celui de
l'application) pour l'OAuth, `UserSettings.trelloSecret` pour une connexion héritée.
```

- [ ] **Step 3: Mettre à jour la liste des routes API de `CLAUDE.md`**

Ajouter :

```markdown
- `/api/trello/connect` — démarre l'autorisation OAuth (302 vers Trello)
- `/api/trello/callback` — retour de Trello, échange et stocke le jeton
- `/api/trello/disconnect` — révoque le jeton, supprime le webhook, efface tout
```

Et corriger la ligne `/api/user/settings` : elle n'accepte plus de secret Trello.

- [ ] **Step 4: Mettre à jour la liste des variables d'environnement de `CLAUDE.md`**

Remplacer le bloc `TRELLO_*` par :

```
TRELLO_API_KEY          # clé de l'APPLICATION MyFlip (trello.com/power-ups/admin)
TRELLO_API_SECRET       # OAuth Secret : signe l'OAuth et valide les webhooks
```

et noter que les six autres `TRELLO_*` ne sont plus lues.

- [ ] **Step 5: Mettre à jour `README.md`**

Aligner les mentions de la configuration Trello sur le nouveau parcours.

- [ ] **Step 6: Vérification finale complète**

Run: `npx tsc --noEmit && npm test && npx next lint`
Expected: aucune erreur, toutes les suites passent.

- [ ] **Step 7: Vérifier qu'aucun secret n'a fui**

Run:
```bash
git diff --cached | grep -iE "TRELLO_(API_)?(KEY|SECRET|TOKEN)\s*=\s*[A-Za-z0-9]" && echo "⚠️ SECRET DANS LE DIFF" || echo "OK, aucun secret"
```
Expected: « OK, aucun secret ».

- [ ] **Step 8: Commit (sur feu vert)**

```bash
git add .env.local.example CLAUDE.md README.md
git commit -m "docs(trello): document the OAuth connection flow"
```

---

## Vérification réelle (hors plan de tâches)

**Ce que je peux vérifier sans navigateur**, dès que `TRELLO_API_SECRET` est posée dans `.env.local` :

```bash
npx tsx -e '
const { loadEnvConfig } = require("@next/env");
loadEnvConfig(process.cwd());
require("tsx/cjs");
const { demanderRequestToken } = require("./lib/trelloOAuth.ts");
demanderRequestToken("https://exemple.test/api/trello/callback")
  .then((r) => console.log("✅ Request token obtenu, longueur:", r.token.length))
  .catch((e) => console.error("❌", e.message));
'
```

Un jeton renvoyé prouve que la signature HMAC-SHA1, l'encodage RFC 3986, l'ordre des paramètres et l'en-tête `Authorization` sont tous corrects. C'est la seule étape du flux qui ne demande pas de navigateur.

**Ce qui reste à la charge d'Aramis** — tout est derrière l'auth MyFlip et derrière l'écran d'autorisation Trello :

1. Connexion d'un nouvel utilisateur (ami) — clic, autorisation, retour.
2. Refus de l'autorisation — vérifier le message « La connexion Trello a été refusée. »
3. Callback valide — « Trello est connecté. »
4. Callback invalide — ouvrir `/api/trello/callback?oauth_token=faux&oauth_verifier=faux`, attendre « Ce retour de Trello ne correspond pas… »
5. Récupération des boards — la liste se remplit seule.
6. Sélection d'un board.
7. Récupération des labels — la liste se remplit après le choix du board.
8. Sélection des deux labels + « Enregistrer » — le webhook doit se créer sans autre clic.
9. Poser « À comptabiliser » sur une carte dont le titre contient un SKU connu.
10. Vérifier la détection du SKU dans les logs Vercel (`[trello]`).
11. Vérifier l'apparition de l'article dans `/a-comptabiliser`.
12. Valider la vente.
13. Vérifier que « Comptabilisé » apparaît sur la carte et que « À comptabiliser » a disparu.
14. Deux comptes MyFlip avec deux comptes Trello différents, deux boards différents.
15. Vérifier qu'aucun des deux ne voit les boards de l'autre.
16. « Déconnecter Trello » — vérifier dans `trello.com/my/account`, section applications, que MyFlip n'y est plus.
17. Reconnexion — le parcours doit repartir de zéro proprement.
