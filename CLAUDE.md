# CLAUDE.md — MyFlip

Guidance for Claude Code when working in this repository.

## 📱 Mobile Design Rules — iPhone 14 (390px)

APPROCHE MOBILE FIRST : styles de base = mobile (pas de préfixe), desktop = préfixe md:

### Breakpoints MyFlip
- Pas de préfixe → < 768px (iPhone 14, tous les téléphones)
- md: → ≥ 768px (desktop/tablette)

### Touch Targets (Apple HIG)
Tout élément cliquable : min-height 44px. Utiliser h-11, py-3 ou min-h-[44px] sur boutons, lignes de liste, icônes nav.

### Safe Area iPhone
Dans app/layout.tsx, meta viewport doit avoir : viewport-fit=cover
La bottom navigation doit avoir : paddingBottom: env(safe-area-inset-bottom)

### Tables → Jamais sur mobile
Pattern obligatoire :
<div className="hidden md:block">tableau</div>
<div className="md:hidden">cartes</div>

### Sidebar
Mobile : masquée, bottom nav visible, pas de margin-left sur le contenu
Desktop (md+) : 260px fixe, ml-[260px] sur le contenu

### Typographie mobile
text-3xl md:text-4xl pour les titres de page
Jamais en dessous de text-sm pour le contenu

### Espacement mobile
px-4 sur mobile, px-6 sur md+
Empiler : flex-col md:flex-row
Pleine largeur : w-full md:w-auto

### Règle générale
Chaque nouveau composant/page : tester mentalement à 390px avant 1280px.

---

## 🏗️ Architecture

### Auth (NextAuth v5)
Split obligatoire en deux fichiers — ne jamais fusionner :
- `auth.config.ts` : version légère sans Prisma ni bcrypt, utilisée par le middleware Edge
- `auth.ts` : version complète avec Prisma + bcryptjs, utilisée côté Node (API routes, Server Components)

Les credentials sont stockés en base de données (table `User` Prisma/Neon), pas en variables d'env.
`AUTH_EMAIL` / `AUTH_PASSWORD` dans `.env.local` sont des reliquats de bootstrap initial — ne pas s'y fier pour la logique d'auth.

### Base de données
Prisma ORM + Neon PostgreSQL. Schéma dans `prisma/schema.prisma`.
Modèle `User` : `id`, `email`, `password` (bcrypt), `resetToken`, `resetTokenExp`, `createdAt`.

⚠️ **Marque / catégorie des articles.** En base, `Article.marque` et `Article.categorie` contiennent le même **libellé de lot** (« Polo Ralph Lauren »), qui mélange marque et type d'article. C'est cette valeur qui pilote les filtres du Stock.
`app/mise-en-vente/page.tsx` la redécoupe pour l'annonce (« Ralph Lauren » + « Polo ») via `MARQUE_LISTING_MAP` / `listingLabels()`. Conversion **d'affichage uniquement** : ne jamais réécrire ces valeurs en base — cela casserait les filtres du Stock.
Les lots multimarques (`Mix TNF/PAT/COL`, `Crazy Polaires`…) mappent volontairement sur une marque vide : c'est à l'utilisateur ou à l'IA de trancher.

### Emails transactionnels
`lib/emails.ts` expose `sendWelcomeEmail()` et `sendResetEmail()`.
SDK Resend, expéditeur `onboarding@resend.dev`. Requiert `RESEND_API_KEY` dans `.env.local`.

---

## 🗂️ Pages & Routes

### Pages principales
- `/dashboard` — KPIs, CA par semaine, par marque
- `/stock` — liste articles, filtres, virtualisation
- `/mise-en-vente` — génération d'annonces IA
- `/a-comptabiliser` — articles à comptabiliser
- `/calendrier` — ventes par mois
- `/commandes` — gestion des commandes fournisseur
- `/statistiques` — stats avancées
- `/parametres` — prompts IA (modèles d'annonces)
- `/compte` — Mon compte + changement de mot de passe
- `/login` — connexion + mot de passe oublié (inline)
- `/reset-password` — réinitialisation via token email

### Pages légales (sans sidebar, sans auth)
- `/legal/mentions-legales`
- `/legal/cgu`
- `/legal/confidentialite`

### API Routes
- `/api/auth/forgot-password` — génère un token, envoie l'email via Resend
- `/api/auth/reset-password` — valide le token, met à jour le mot de passe
- `/api/user/password` — changement de mot de passe (authentifié)
- `/api/articles`, `/api/articles/[id]` — CRUD articles
- `/api/commandes`, `/api/commandes/[id]` — CRUD commandes
- `/api/dashboard`, `/api/stats`, `/api/calendar` — données agrégées
- `/api/prompts`, `/api/prompts/[id]` — CRUD prompts IA
- `/api/listings/generate` — génération d'annonces (Anthropic/Gemini)
- `/api/chat` — chatbot IA
- `/api/webhooks/trello` — intégration Trello

---

## 🧩 Composants clés

- `components/Sidebar.tsx` — sidebar desktop + bottom nav mobile. Nav : Dashboard, Stock, Mise en vente, À comptabiliser, Calendrier, Commandes, Statistiques, Prompts (/parametres), Mon compte (/compte). Footer : liens légaux + © 2026 MyFlip.
- `components/AppShell.tsx` — enveloppe l'app. Exclut la sidebar pour `/login`, `/reset-password`, et `/legal/*`.
- `components/Loader.tsx` — animation TRACE (logo M monoline qui se dessine, keyframes `atlas-draw` + `atlas-dots` dans `globals.css`). Props : `label` (string) et `size` ("sm" | "md"). Remplace tous les spinners et skeleton loaders.
- `components/WelcomeModal.tsx` — modal premier lancement, affiché une fois via `localStorage.myflip_welcomed`.
- `components/ChatBot.tsx` — assistant IA flottant.

Pour tout état de chargement : utiliser `<Loader>`. Il n'y a plus de composant skeleton.

---

## 🎨 Assets & Design

### Logo ATLAS
`public/logo-atlas/` contient le pack logo :
- `myflip-favicon-32.png` — favicon 32×32 (référencé dans `layout.tsx` metadata icons)
- `myflip-icon-180.png` — apple-touch-icon 180×180
- `myflip-sidebar.svg` — icône + wordmark, fond transparent, utilisé dans la sidebar (`h-11`)
- `myflip-icon.svg` — icône seule sur fond `#1B4332`

### Design system
`docs/design-system.md` — tokens Forest Precision (couleurs, typographie). Source de vérité pour la palette.
Couleurs principales : `#1B4332` (vert forêt), `#A8D5B5` (mint), `#16261D` (ink), `#EEF1EC` (surface).

---

## 🔗 Intégration Trello

Deux sens de synchronisation, à ne pas confondre :

**Trello → MyFlip** (`app/api/webhooks/trello/route.ts`)
L'étiquette violette « À comptabiliser » (`TRELLO_LABEL_ID`) sur une carte fait passer les articles correspondants au statut « À comptabiliser ». Le nom de la carte peut contenir plusieurs SKUs (`"SDM11 SDM36 ADI36"`). Le webhook ne crée jamais d'article : un SKU inconnu est loggé et ignoré.

⚠️ **Piège.** Trello n'émet `addLabelToCard` que si l'étiquette est posée **après coup**. Une carte qui *arrive* déjà étiquetée (création avec étiquette cochée, duplication, déplacement depuis un autre board) ne déclenche aucun événement d'étiquette. Le webhook écoute donc aussi `createCard`, `copyCard`, `moveCardToBoard`, `updateCard` et `convertToCardFromCheckItem`, et interroge l'API pour lire les étiquettes réelles de la carte (cf. `CARD_ACTIONS`). Ne pas restreindre ce filtrage sans comprendre ce piège.

**MyFlip → Trello** (`app/api/articles/[id]/comptabiliser/route.ts`)
À la validation comptable : retrait de « À comptabiliser » puis pose de « Comptabilisé » (`TRELLO_COMPTABILISE_LABEL_ID`). Les deux appels sont **best-effort** et indépendants : un échec Trello ne doit jamais bloquer la validation comptable. La carte n'est pas archivée.

Le transporteur d'un article est déduit du nom de l'**autre** étiquette de la carte (Mondial Relay, Colissimo, UPS…) — d'où l'exclusion explicite des deux étiquettes de statut lors de cette détection.

Les IDs d'étiquettes se listent avec :
`GET https://api.trello.com/1/boards/{TRELLO_BOARD_ID}/labels?key={KEY}&token={TOKEN}`

---

## 🔧 Scripts

- `scripts/init-user.mjs` — crée l'utilisateur en base + envoie l'email de bienvenue. One-shot, gitignored.
- `scripts/setup-trello-webhook.ts` — configure le webhook Trello. À relancer si le board change.
- `scripts/organiser_annonces.py` — organise les ZIPs d'annonces dans le Finder. Usage Mac local uniquement.

---

## 🔑 Variables d'environnement requises

```
AUTH_SECRET
AUTH_TRUST_HOST=true
NEXTAUTH_URL
ANTHROPIC_API_KEY
GEMINI_API_KEY
TRELLO_API_KEY
TRELLO_TOKEN
TRELLO_BOARD_ID
TRELLO_LABEL_ID               # étiquette « À comptabiliser » (violette)
TRELLO_COMPTABILISE_LABEL_ID  # étiquette « Comptabilisé » (verte)
RESEND_API_KEY
NEXT_PUBLIC_USER_NAME   # prénom affiché dans le dashboard
DATABASE_URL            # Neon PostgreSQL (dans .env, géré par Vercel/Prisma)
```
