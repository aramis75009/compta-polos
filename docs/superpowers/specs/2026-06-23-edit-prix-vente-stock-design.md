# Édition du prix de vente depuis la fiche détail (Stock)

**Date :** 2026-06-23
**Statut :** Validé — prêt à implémenter

## Problème

Quand un article est comptabilisé (passé « Vendu »), le prix de vente est saisi via
le `SellModal`. En cas de faute de frappe (ex. 100 € au lieu de 10 €), l'utilisateur
ne peut plus corriger le prix de vente depuis le stock :

- La colonne « Prix vente » du tableau est **masquée par défaut** (`defaultVisible: false`).
- Elle n'est éditable que pour les articles « Vendu » (`editable={vendu}`).
- La fiche détail (bouton 📄) est en lecture seule pour les infos de vente.

Le prix d'achat, la marque, la catégorie et le SKU sont déjà éditables inline ; le
prix de vente, lui, est inaccessible en pratique.

## Solution

Rendre les informations de vente éditables dans le **modal de détail** (`app/stock/page.tsx`).
Aucun changement backend : la route `PATCH /api/articles/[id]` accepte déjà
`prixVente`, `dateVente`, `canal` et recalcule `margeBrute`, `margeNette`,
`coefficient` via `deriveVente`.

### Comportement

Pour un article au statut **« Vendu »**, la fiche détail affiche une section
« Informations de vente » avec :

- **Prix de vente** — `EditableCell` (double-clic pour modifier), recalcul auto.
- **Date de vente** — `EditableCell` (même format que le tableau : valeur
  `dateVente.slice(0,10)`, affichage `toLocaleDateString("fr-FR")`, save → ISO).
- **Canal** — `<select>` avec la liste `CANAUX` de `lib/canalColors`.
- **Marge nette** — affichée en dessous, recalculée en direct après correction.

Pour un article non vendu : pas de section vente (rien à corriger).

### Détail technique

`detailTarget` est une copie figée de l'article au clic. Pour que la marge se mette
à jour visuellement après correction, le modal lit l'article **vivant** depuis la
liste chargée :

```ts
const detail = detailTarget
  ? (articles.find((a) => a.id === detailTarget.id) ?? detailTarget)
  : null;
```

Les corrections passent par le `handlePatch(id, patch)` existant (mutation React
Query qui invalide le cache → la fiche reflète la nouvelle marge).

### Cohérence

- Édition par double-clic = même geste que dans le tableau (ethos « façon Excel »).
- Réutilise `EditableCell`, `CANAUX`, `handlePatch` — pas de nouveau composant.

## Périmètre

- **1 fichier** : `app/stock/page.tsx` (~40 lignes dans le bloc `<Modal>` détail).
- Pas de migration, pas de changement d'API, pas de nouveau composant.

## Hors périmètre

- Édition inline sur mobile (vue cartes) — sujet séparé.
- Rendre la colonne « Prix vente » visible par défaut dans le tableau.
