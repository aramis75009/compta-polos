# Connexion Trello par OAuth — design

**Date** : 15/08/2026
**État** : validé par Aramis, prêt pour le plan d'implémentation

## Le problème

Pour brancher Trello, MyFlip demande aujourd'hui à l'utilisateur trois valeurs
copiées depuis `trello.com/app-key` : une clé d'API, un token et un secret
d'API. C'est un mur : l'écran suppose qu'on sache ce qu'est un token, et le
parcours de démarrage y bute dès l'étape 1.

Deux conséquences moins visibles :

1. **Le repli sur l'environnement laisse fuiter un board.** Un compte sans
   réglages Trello retombe sur `TRELLO_API_KEY` / `TRELLO_TOKEN` /
   `TRELLO_BOARD_ID` du déploiement. Concrètement, un nouvel utilisateur lit et
   écrit sur le board du propriétaire.
2. **Le secret de webhook est demandé au mauvais acteur.** La signature
   `x-trello-webhook` se valide avec le secret de l'*application*, pas avec un
   secret par utilisateur. Le champ existant ne peut donc être renseigné
   correctement que par quelqu'un qui possède l'app.

## L'objectif

Un ami clique sur « Connecter Trello », autorise MyFlip chez Trello, choisit son
board et ses deux étiquettes. Il ne voit jamais le mot « token ». Aramis, lui,
garde sa connexion actuelle par clés API sans interruption de service.

La logique métier ne change pas : SKU dans le titre de carte, étiquette « À
comptabiliser » qui fait basculer les articles, étiquette « Comptabilisé »
reposée à la validation de la vente.

## Le flux retenu : OAuth 1.0a

Trello n'expose que deux mécanismes d'autorisation, et **pas d'OAuth 2.0 sur son
API REST** (doc Atlassian, vérifiée le 15/08/2026) :

| Flux | Endpoints | Où atterrit le token |
|---|---|---|
| Route `/1/authorize` | `trello.com/1/authorize?response_type=token&callback_method=fragment\|postMessage` | **Dans le navigateur** — fragment d'URL ou `postMessage` |
| OAuth 1.0a | `OAuthGetRequestToken` → `OAuthAuthorizeToken` → `OAuthGetAccessToken` | **Côté serveur uniquement** |

Le premier est disqualifié par la contrainte « aucun token dans le frontend » :
il n'a aucune variante qui rende le token à un serveur.

OAuth 1.0a apporte en plus trois choses qui simplifient le code existant :

- **Le token obtenu s'utilise comme un `key=…&token=…` ordinaire.** `lib/trello.ts`
  n'est pas modifié. Le protocole ne sert qu'à *obtenir* le token, pas à s'en servir.
- **La signature des webhooks utilise le secret de l'application**, un seul, côté
  serveur. Le champ « Secret d'API » par utilisateur disparaît.
- **Aucune dépendance nouvelle** : la signature HMAC-SHA1 tient en une centaine
  de lignes avec le `crypto` de Node.

### Compatibilité OAuth 2.0

Tout le protocole vit dans `lib/trelloOAuth.ts`, derrière trois fonctions
(`demarrerAutorisation`, `terminerAutorisation`, `revoquer`). Le stockage est
« un token opaque, chiffré, plus une expiration ». Si Trello publie un jour un
OAuth 2.0, seul ce fichier change ; ni `lib/settings.ts`, ni `lib/trello.ts`, ni
l'interface ne bougent.

## Architecture

### Routes

| Route | Méthode | Rôle |
|---|---|---|
| `/api/trello/connect` | GET | Authentifiée. Obtient un request token auprès de Trello, le stocke chiffré et lié au `userId`, redirige 302 vers l'écran d'autorisation Trello. |
| `/api/trello/callback` | GET | Retour de Trello. Vérifie la session, vérifie que l'`oauth_token` reçu est bien celui stocké **pour ce compte**, l'échange contre un access token, le chiffre, efface l'éphémère. Redirige vers `/compte` ou `/demarrage` avec un code de résultat. |
| `/api/trello/disconnect` | POST | Supprime le webhook, révoque le token (`DELETE /1/tokens/{token}`), efface les colonnes. |
| `/api/user/settings/trello` | GET | Inchangée : boards, ou étiquettes d'un board. |
| `/api/user/settings/trello` | POST | Conservée, mais appelée automatiquement à l'enregistrement du board. |
| `/api/user/settings/trello/setup` | POST | Inchangée : crée colonnes et étiquettes. |
| `/api/webhooks/trello` | POST | Inchangée sauf la source du secret de signature. |

### Séquence

```
Utilisateur          MyFlip                            Trello
    │                  │                                 │
    │ clic Connecter   │                                 │
    ├─────────────────>│                                 │
    │                  │ POST OAuthGetRequestToken       │
    │                  │  (signé clé+secret de l'app)    │
    │                  ├────────────────────────────────>│
    │                  │<────── oauth_token + secret ────┤
    │                  │ stocke le request token,        │
    │                  │ chiffré, lié au userId, 10 min  │
    │<─── 302 ─────────┤                                 │
    │                                                    │
    │ écran d'autorisation Trello (scope read,write)     │
    ├───────────────────────────────────────────────────>│
    │<────────── 302 vers /api/trello/callback ──────────┤
    │            ?oauth_token=…&oauth_verifier=…         │
    │                  │                                 │
    ├─────────────────>│ vérifie session + appartenance  │
    │                  │ POST OAuthGetAccessToken        │
    │                  ├────────────────────────────────>│
    │                  │<─────── access token ───────────┤
    │                  │ chiffre, stocke, efface l'éphémère
    │<─── 302 /compte?trello=ok ─────────────────────────┤
```

### Base de données

Migration écrite à la main — jamais `prisma migrate dev` ni `prisma db push`,
qui proposent un `DROP COLUMN "photosPretes"` (cf. CLAUDE.md).

```sql
ALTER TABLE "UserSettings"
  ADD COLUMN "trelloOauthToken"         TEXT,          -- chiffré (AES-256-GCM)
  ADD COLUMN "trelloOauthTokenSecret"   TEXT,          -- chiffré
  ADD COLUMN "trelloOauthRequestToken"  TEXT,          -- éphémère, en clair (identifiant public)
  ADD COLUMN "trelloOauthRequestSecret" TEXT,          -- éphémère, chiffré
  ADD COLUMN "trelloOauthExpire"        TIMESTAMP(3),  -- péremption du request token
  ADD COLUMN "trelloMembreId"           TEXT,
  ADD COLUMN "trelloMembreNom"          TEXT,          -- « Connecté en tant que … »
  ADD COLUMN "trelloWebhookId"          TEXT;          -- pour le supprimer proprement
```

**Aucune colonne n'est supprimée.** `trelloKey`, `trelloToken` et `trelloSecret`
survivent pour les connexions héritées, au même titre que `geminiKey` et
`photosPretes`.

`trelloOauthTokenSecret` n'est pas utilisé aujourd'hui — les appels passent par
`key`/`token`. Il est conservé parce qu'il est indispensable pour signer les
requêtes si l'on doit un jour y revenir, et qu'il ne se récupère plus après coup.

### Résolution des identifiants — `lib/settings.ts`

```
1. trelloOauthToken présent → { key: TRELLO_API_KEY (l'app), token: oauth }   source « oauth »
2. sinon trelloKey + trelloToken du compte                                     source « héritée »
3. sinon → null.   Plus aucun repli sur l'environnement.
```

Le secret de signature du webhook suit la connexion :
`TRELLO_API_SECRET` pour une connexion OAuth, `trelloSecret` du compte pour une
connexion héritée. Sans secret, le comportement actuel est conservé : l'événement
passe et l'absence de vérification est journalisée.

`boardDuCompte` disparaît : sans repli sur l'environnement, un `boardId` présent
appartient forcément au compte. Le garde-fou qu'il portait devient structurel.

### Migration des données existantes

`scripts/migrer-trello-env.ts`, idempotent : si le compte désigné par
`TRELLO_OWNER_EMAIL` (à défaut, le plus ancien) n'a ni token OAuth ni clé
héritée, y recopier — chiffrées — les valeurs `TRELLO_API_KEY`, `TRELLO_TOKEN`,
`TRELLO_SECRET`, et en clair `TRELLO_BOARD_ID`, `TRELLO_LABEL_ID`,
`TRELLO_COMPTABILISE_LABEL_ID`.

C'est ce qui permet de supprimer le repli sans déconnecter Aramis. À lancer une
fois sur la production **avant** le déploiement du retrait.

## Interface

### Module « Mon Trello » (`components/compte/Integrations.tsx`)

Les trois `ChampSecret` Trello sont supprimés. Trois états :

**Non connecté**
> Trello n'est pas connecté
> `[ Connecter Trello ]`

**Connecté (OAuth)**
> ✓ Trello connecté — *nom du membre Trello*
> Board surveillé `[▾]`
> Étiquette « À comptabiliser » `[▾]`
> Étiquette « Comptabilisé » `[▾]`
> `[ Enregistrer ]`  ·  Déconnecter Trello

**Connecté (héritée)** — identique, plus un bandeau « Connexion par clés API »
et un bouton « Passer à la connexion Trello ».

Le bouton « Enregistrer » enregistre board + étiquettes **et** crée le webhook
dans la foulée. Un bouton « Réparer la connexion » reste disponible si le webhook
a été perdu côté Trello.

### Parcours de démarrage (`app/demarrage/page.tsx`)

Passe de 4 à 3 étapes :

1. **Connecter Trello** — un bouton, plus un lien vers `trello.com/app-key`.
2. **Préparer le board** — inchangé (colonnes, étiquettes, idempotent).
3. **Ta première commande** — inchangé.

L'ancienne étape 3 (« Recevoir les événements ») disparaît : le webhook se crée
tout seul. `onboardingEtape` reste borné côté API, et une valeur 4 déjà en base
retombe sur 3.

## Sécurité

| Exigence | Réponse |
|---|---|
| Aucun token dans le frontend | OAuth 1.0a : le token ne transite que serveur↔Trello. L'API ne renvoie jamais que « connecté » + le nom du membre. |
| Stockage sécurisé | AES-256-GCM via `lib/crypto.ts`, comme les clés IA. |
| Aucun secret au dépôt | `TRELLO_API_SECRET` en variable d'environnement ; `.env.local.example` ne porte qu'un nom vide. |
| Aucun secret dans les logs | Les journaux `[trello]` ne portent que des identifiants publics (board, carte, SKU). L'échec de déchiffrement journalise l'erreur, pas la valeur. |
| Isolation entre utilisateurs | Le repli sur l'environnement est supprimé. Chaque contexte Trello vient de la ligne `UserSettings` du compte de la session. |
| Propriété de la connexion | Le callback refuse tout `oauth_token` qui n'est pas celui stocké pour l'utilisateur de la session courante. |
| CSRF / state | Le request token **est** le state : lié au `userId` en base, à usage unique, périmé après 10 minutes. |
| Validation du callback | Construit depuis `origineDe(req)`, jamais depuis `NEXTAUTH_URL`. Refusé si `NEXT_PUBLIC_APP_HOST` est configuré et ne correspond pas à l'hôte servi. |
| Autorisation expirée ou révoquée | Un 401 Trello efface le token stocké et affiche « Ta connexion Trello n'est plus valide. Reconnecte ton compte. » |
| Permissions minimales | `scope=read,write`. **Pas `account`.** |

### Permissions demandées

`scope=read,write`, `expiration=never`, `name=MyFlip`.

- **read** — lister les boards, lire les étiquettes d'un board, lire les
  étiquettes et le nom d'une carte, lire l'identité du membre (`/1/members/me`,
  accessible en lecture seule).
- **write** — poser « Comptabilisé », retirer « À comptabiliser », créer les
  colonnes et étiquettes du démarrage, enregistrer le webhook.
- **account** n'est **pas** demandé : MyFlip n'a besoin ni de l'email Trello ni
  des informations de compte.

## Gestion des erreurs

Le callback redirige avec un code, converti en message par l'interface.

| Cas | Message |
|---|---|
| Autorisation refusée | « La connexion Trello a été refusée. Aucun accès n'a été enregistré. » |
| Erreur du protocole OAuth | « La connexion à Trello a échoué. Réessaie dans un instant. » |
| Callback invalide / non concordant | « Ce retour de Trello ne correspond pas à ta demande de connexion. Relance la connexion. » |
| Demande expirée | « Ta demande de connexion a expiré. Relance-la. » |
| Token invalide, expiré ou révoqué | « Ta connexion Trello n'est plus valide. Reconnecte ton compte Trello. » + effacement du token stocké |
| Aucun board accessible | « Aucun tableau accessible avec ce compte Trello. Crée un tableau puis reviens ici. » |
| Aucune étiquette sur le board | « Ce tableau n'a aucune étiquette. Passe par “Préparer le board” pour les créer. » |
| Board supprimé | « Le tableau surveillé n'existe plus. Choisis-en un autre. » |
| Étiquette supprimée | « Une des deux étiquettes n'existe plus sur ce tableau. Choisis-la à nouveau. » |
| Erreur API Trello | « Trello n'a pas répondu correctement (code *n*). Réessaie dans un instant. » |

## Variables d'environnement

| Variable | Devient |
|---|---|
| `TRELLO_API_KEY` | **Conservée** — la clé de l'*application* MyFlip, commune à tous. |
| `TRELLO_API_SECRET` | **Nouvelle, obligatoire** — signe les requêtes OAuth et valide la signature des webhooks. |
| `TRELLO_TOKEN` | Retirée de la logique. Lue une dernière fois par le script de migration. |
| `TRELLO_SECRET` | Idem. |
| `TRELLO_BOARD_ID` | Idem. |
| `TRELLO_LABEL_ID` | Idem. |
| `TRELLO_COMPTABILISE_LABEL_ID` | Idem. |
| `TRELLO_OWNER_EMAIL` | Idem — ne sert plus qu'à désigner la cible de la migration. |

## Tests

**Automatisés** (vitest, logique pure — le parti pris du dépôt) :
signature OAuth 1.0a sur les vecteurs de la RFC 5849, encodage percent
conforme, construction de l'URL d'autorisation, parsing des réponses
form-encoded, cascade de `resoudreReglages` (oauth / héritée / aucune),
traduction des codes d'erreur.

**Vérification réelle sans navigateur** : obtention d'un request token auprès de
Trello avec la clé et le secret de l'application. Elle valide la signature de
bout en bout.

**À la charge d'Aramis, dans le navigateur** — tout le reste est derrière l'auth
MyFlip et derrière l'écran d'autorisation Trello : connexion d'un nouvel
utilisateur, refus d'autorisation, récupération des boards et des étiquettes,
pose de « À comptabiliser » sur une carte, apparition de l'article, validation de
la vente, pose de « Comptabilisé », deux comptes MyFlip avec deux comptes Trello,
déconnexion et reconnexion.

## Ce qui ne change pas

- `lib/trello.ts` — pas une ligne.
- `lib/trelloSetup.ts`, `lib/trelloConstantes.ts` — pas une ligne.
- La détection des SKU, les six types d'action écoutés par le webhook, la
  déduction du transporteur depuis l'*autre* étiquette de la carte.
- Le caractère best-effort de la synchro à la validation comptable : un échec
  Trello ne bloque jamais l'opération métier.

## Dette assumée

- `scripts/setup-trello-webhook.ts` devient sans objet une fois la migration
  passée. Il est conservé le temps de vérifier la bascule en production, puis
  supprimé.
- `trelloOauthTokenSecret` est stocké sans être lu (voir plus haut).
- Les colonnes `trelloKey` / `trelloToken` / `trelloSecret` restent peuplées pour
  les connexions héritées. Elles ne pourront être supprimées que quand plus aucun
  compte n'aura de connexion héritée.
