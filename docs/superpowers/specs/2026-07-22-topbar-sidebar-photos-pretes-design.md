# Spec — Barre supérieure, sidebar repliable & statut « Photos prêtes »

Date : 2026-07-22
Statut : validé, implémenté.

Trois chantiers menés ensemble. Le design visuel fin est susceptible d'être
retouché ensuite via Claude Design ; cette spec fige **l'intention et le
comportement**, pas les pixels.

---

## 1. Statut « Photos prêtes »

**Intention.** Rendre visible et filtrable le jalon « article photographié,
prêt pour la mise en vente ». Ce concept existait déjà en base sous forme d'un
booléen `Article.photosPretes` (affiché seulement via une icône dans le Stock et
dans les notifications). On le **promeut en statut à part entière** — une seule
source de vérité, filtrable comme les autres statuts (chip, couleur, notif).

**Cycle de vie.**
`En stock` → **`Photos prêtes`** → `Brouillon` / `En vente` → `En livraison`
→ `À comptabiliser` → `Vendu`.

**Changements de code.**
- `lib/calc.ts` : `"Photos prêtes"` inséré dans `STATUTS` après `"En stock"` ;
  const `STATUT_PHOTOS_PRETES`.
- `lib/statutColors.ts` : couleur rose `#FBEAF1` / `#BE4B7E` (distincte du jaune
  « En stock » et du bleu « En vente » — ajustable par Claude Design).
- Champ `Article.photosPretes` retiré du schéma Prisma **et** de tout le code
  (`serialize`, `types`, `hooks`, `PATCH /api/articles/[id]`,
  `commandes/[id]/stats`, `notifications`, icône `PhotosReadyIcon` du Stock).
- Notifications : « Stock sans photos prêtes » = simplement `statut === "En stock"` ;
  nouvelle notif « Photos prêtes à mettre en vente » (`statut === "Photos prêtes"`).
- Réglage manuel via les contrôles de statut déjà en place (édition, sélection
  multiple au glissement, chatbot). Pas de nouveau contrôle.

**Migration base de données (production — Neon, `prisma db push`, PAS de
`migrate deploy` au build).** Le push sur `main` ne touche donc pas la base.
Ordre à respecter, **manuellement**, côté utilisateur :
1. `node scripts/migrate-photos-pretes.mjs` — bascule les `En stock` +
   `photosPretes = true` vers `Photos prêtes` (raw SQL, idempotent).
2. (optionnel, plus tard) `prisma db push` pour supprimer physiquement la colonne
   `photosPretes`. Tant que ce n'est pas fait, la colonne reste en base, inutilisée
   et inoffensive (le code n'y touche plus ; les insertions gardent le default).
   ⚠️ Ne jamais lancer le `db push` **avant** l'étape 1, sous peine de perdre le
   drapeau.

---

## 2. Barre supérieure

**Problème constaté.** Le fil « Pilotage › <Page> » faisait doublon (chaque page
a déjà son gros titre dans le contenu), en petit et pâle, laissant la barre vide.

**Décisions.**
- La barre supérieure devient **l'unique source du titre de page** : nom de la
  page seul (sans « Pilotage »), en plus gros (`font-grotesk`, 18/20px).
- Les pages **ne répètent plus** ce titre dans leur contenu : `<h1>` supprimé sur
  Stock, Mise en vente, À comptabiliser, Calendrier, Commandes, Prompts,
  Statistiques, Mon compte. Les **sous-titres sont conservés**. Le Dashboard
  garde « Bonjour <prénom> 👋 » (accueil, pas un doublon).
- **Avatar + menu compte** ajouté à droite du toggle thème (`components/AccountMenu.tsx`) :
  initiale dérivée de `NEXT_PUBLIC_USER_NAME`, menu { Mon compte, Déconnexion }.
  L'avatar est **retiré du contenu** du Dashboard et des Statistiques.

---

## 3. Sidebar

- En-tête « PILOTAGE » supprimé (redondant).
- Libellés de nav agrandis (14,5 → 15,5px) + plus d'air vertical, pour combler le
  vide entre « Mon compte » et « Déconnexion ».
- Carte « Nouveautés — de nouvelles fonctionnalités arrivent bientôt » ajoutée en
  bas de sidebar (teaser).
- **Repli en rail d'icônes** (bouton `PanelLeft` posé sur la bordure droite) :
  - Largeur pilotée par `--sidebar-w` (256px ↔ 74px) via `data-sidebar` sur
    `<html>`, posé **sans flash** par le script inline de `layout.tsx` puis par le
    bouton ; apparence rail pilotée par CSS (`.sb-hide-collapsed` / `.sb-only-collapsed`
    / `.sb-item`) → pas de flash à l'hydratation. État mémorisé dans `localStorage`
    (`myflip-sidebar`).
  - En rail : logo → icône carrée, libellés masqués (tooltip natif au survol),
    badge « à comptabiliser » réduit à une pastille, carte « Nouveautés » réduite à
    une icône. Le contenu s'élargit (offset `md:pl-[var(--sidebar-w)]`, animé).
  - Le mobile (bottom nav) n'est pas concerné.

Tout reste compatible thème clair / sombre (tokens CSS + couleurs de marque
littérales).
