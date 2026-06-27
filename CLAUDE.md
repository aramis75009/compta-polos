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
- `components/Skeleton.tsx` — `SkeletonBlock` et `SkeletonCard` (conservés mais plus utilisés dans les pages — préférer `<Loader>`).
- `components/ChatBot.tsx` — assistant IA flottant.

---

## 🎨 Assets & Design

### Logo ATLAS
`public/logo-atlas/` contient le pack logo :
- `myflip-favicon-32.png` — favicon 32×32 (référencé dans `layout.tsx` metadata icons)
- `myflip-icon-180.png` — apple-touch-icon 180×180
- `myflip-sidebar.svg` — icône + wordmark, fond transparent, utilisé dans la sidebar (`h-11`)
- `myflip-icon.svg` — icône seule sur fond `#1B4332`

### Design system
`DESIGN.md` — tokens Forest Precision (couleurs, typographie). Source de vérité pour la palette.
Couleurs principales : `#1B4332` (vert forêt), `#A8D5B5` (mint), `#16261D` (ink), `#EEF1EC` (surface).

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
TRELLO_LABEL_ID
RESEND_API_KEY
NEXT_PUBLIC_USER_NAME   # prénom affiché dans le dashboard
DATABASE_URL            # Neon PostgreSQL (dans .env, géré par Vercel/Prisma)
```
