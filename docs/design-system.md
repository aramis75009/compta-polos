---
name: Direction C — Console tactile
# Relevé sur le code shippé le 09/08/2026 : app/globals.css, tailwind.config.ts,
# app/layout.tsx, components/. Les valeurs ci-dessous ne sont pas une intention,
# ce sont celles qui s'affichent. Toute divergence = le code a raison, corriger ici.
fonts:
  ui: Space Grotesk # next/font/google → --font-grotesk (font-sans, font-grotesk)
  mono: JetBrains Mono # → --font-mono (font-mono)
theme:
  mechanism: data-theme="dark" sur <html>, posé avant le premier paint
  storage: localStorage "myflip-theme"
  default: clair (la maquette d'origine était sombre par défaut, l'app fait l'inverse)
colors-light:
  bg: "#e7ece8"
  surface: "#ffffff"
  surface-2: "#f3f6f3"
  tint: "#f3f6f3"
  raise: "#e9eeea"
  border: "#dde4df"
  border-strong: "#c6d1ca"
  disabled: "#c6d1ca"
  ink: "#0e1412"
  ink2: "#4c5b54"
  muted: "#75857c"
  faint: "#75857c"
  faint-2: "#75857c"
  nav: "#4c5b54"
  acc: "#0f5132"
  acc-ink: "#ffffff"
  acc-hover: "#0b3d25"
  acc-soft: "#e6efe9"
  acc-soft-strong: "#cfe6d9"
  acc-dim: "#9fd4b5"
  acc-ring: "rgba(15, 81, 50, 0.15)"
  acc-ring-strong: "rgba(15, 81, 50, 0.4)"
  pos: "#0f5132"
  neg: "#b03a28"
  warn: "#b5872e"
  pos-soft: "#e4f3ea"
  neg-soft: "#fbeee7"
  warn-soft: "#fbf3e2"
  shadow: "0 8px 24px rgba(14, 20, 18, 0.08)"
colors-invariant: # identiques dans les deux thèmes, à dessein
  alert: "#c2603f" # notifications « à faire », miroir du statut À comptabiliser
  alert-soft: "#fbeee7"
  notice: "#b5872e" # notifications « à surveiller »
  notice-soft: "#fbf3e2"
colors-dark:
  bg: "#0b0e0d"
  surface: "#141817"
  surface-2: "#1b211f"
  tint: "#1b211f"
  raise: "#232a27"
  border: "#242c29"
  border-strong: "#313b37"
  disabled: "#242c29"
  ink: "#eaf1ec"
  ink2: "#9faea6"
  muted: "#71827a"
  faint: "#71827a"
  faint-2: "#71827a"
  nav: "#9faea6"
  acc: "#c7f751"
  acc-ink: "#0b0e0d"
  acc-hover: "#d4fa6a"
  acc-soft: "#1e2a1c"
  acc-soft-strong: "#2f4227"
  acc-dim: "#38491f"
  acc-ring: "rgba(199, 247, 81, 0.22)"
  acc-ring-strong: "rgba(199, 247, 81, 0.45)"
  pos: "#5fd39b"
  neg: "#ff8a7a"
  warn: "#e5bb63"
  pos-soft: "#16261d"
  neg-soft: "#2a1a18"
  warn-soft: "#262019"
  shadow: "0 10px 30px rgba(0, 0, 0, 0.45)"
radii:
  module: 26px # coquille de section (components/console.tsx → Module)
  card: 22px
  control-lg: 16px
  control: 13px # jeton d'accent, bouton icône
  control-sm: 11px
  pill: 9999px
layout:
  sidebar-expanded: 236px # --sidebar-w
  sidebar-collapsed: 76px # :root[data-sidebar="collapsed"]
  page-padding: 14px # 18px à partir de min-[900px]
  page-gap: 14px
  grid-breakpoint: min-[900px] # ni md: (768) ni lg: (1024)
  touch-target: 44px # Apple HIG, imposé sur tout élément cliquable
---

## Ce qu'est ce document

La source de vérité de l'apparence de MyFlip. Il décrit **Direction C — Console
tactile**, la direction shippée depuis le commit `c9cebca`.

Il a remplacé « Forest Precision » (Plus Jakarta Sans, vert `#1a5336`, mint
`#47c98e`), qui décrivait l'app d'avant la refonte. Cette police n'est plus
chargée nulle part (`app/layout.tsx:9`) et ces couleurs ne pilotent plus rien.
Si tu croises ces noms dans une doc ou un prompt, elle est périmée.

---

## Marque et intention

MyFlip est un **poste de pilotage**, pas un tableau de bord de présentation.
L'utilisateur y passe des heures à saisir, filtrer et comptabiliser 1 200
articles. Le système sert cette densité : filets fins plutôt qu'ombres, chasse
fixe partout où des chiffres doivent s'aligner à l'œil, une seule couleur
d'accent, et le reste en gris-vert désaturé.

Le vocabulaire est celui d'un instrument : « CONSOLE REVENTE » sous le wordmark,
micro-libellés en capitales espacées, codes courts en mono (`DASH`, `STOCK`,
`COMPTA`) quand la sidebar est repliée. Rien de décoratif ne survit s'il ne
porte pas d'information.

---

## Thème clair / sombre

**Les deux thèmes sont de premier rang.** Ce n'est pas un thème clair avec une
variante sombre ajoutée après coup : les deux jeux de valeurs sont relevés sur
la maquette.

Le thème est posé par un script inline dans `app/layout.tsx:70` **avant le
premier paint**, à partir de `localStorage["myflip-theme"]` puis de
`prefers-color-scheme`. Ne jamais déplacer cette logique dans un `useEffect` :
ça réintroduit un flash blanc au chargement en sombre.

### L'accent change de teinte selon le thème, et c'est voulu

| | Clair | Sombre |
|---|---|---|
| `--acc` | `#0f5132` vert forêt | `#c7f751` lime |
| `--acc-ink` | `#ffffff` | `#0b0e0d` |

Le lime serait illisible sur fond clair ; le vert forêt disparaîtrait sur le
graphite. **Ne jamais coder l'accent en dur — toujours `var(--acc)`.** C'est la
règle la plus facile à casser du système : un `bg-[#0f5132]` passe la revue
visuelle en clair et casse le thème sombre sans bruit.

Les alias Tailwind `primary` / `primary-dark` / `on-primary` sont l'ancien nom de
`--acc` / `--acc-hover` / `--acc-ink`. Ils pointent dessus, donc `bg-primary`
suit le thème comme `bg-[var(--acc)]`. Les deux écritures coexistent ; préférer
la variable dans le code neuf.

⚠️ **Piège : pas de modificateur d'opacité sur une variable CSS.**
Tailwind ne sait appliquer une opacité qu'à une couleur qu'il peut décomposer en
canaux, donc à un hex, pas à un `var(--*)`. `ring-primary/15` fonctionnait tant
que `primary` valait un hex en dur ; depuis qu'il pointe sur `--acc` pour suivre
le thème, la même écriture génère une couleur invalide et **aucun halo du tout**.
C'est le prix du thème, payé une fois avec deux tokens :

| Token | Emploi |
|---|---|
| `--acc-ring` | halo de focus des champs (`focus:ring-[var(--acc-ring)]`) |
| `--acc-ring-strong` | focus visible appuyé (sélecteur de statut) |

Même règle pour toute future teinte translucide de l'accent : un token, pas un
`/xx`.

### L'exception : les surfaces qui portent leur propre fond

Quelques éléments posent un fond sombre à eux, indépendant du thème de la page :

| Élément | Fond |
|---|---|
| `SellDialog` | `#16261D` |
| Tuile du `Loader` | dégradé `#214f3b` → `#0e1412` |
| Toast de vente (`lib/celebrate.tsx`) | `#16261D` |

**Sur ces surfaces, les couleurs de contenu doivent être littérales.** Y poser
une variable de thème produit exactement le bug inverse de celui décrit plus
haut : `var(--ink)` vaut `#eaf1ec` en sombre, donc la tuile du Loader virait au
blanc et son logo mint disparaissait dessus dès qu'on basculait le thème.

La question à se poser n'est jamais « littéral ou variable ? » mais **« sur quel
fond est-ce que ça se pose ? »**. Sur le fond de la page → variable. Sur un fond
que le composant fabrique lui-même → littéral.

Les confettis de célébration relèvent du premier cas : ils volent par-dessus la
page, donc ils doivent tenir sur les deux fonds. D'où leurs six teintes de ton
moyen, empruntées à la palette des statuts.

### Neutres

Les neutres ne sont pas des gris : ils sont légèrement verdis (`#e7ece8`,
`#75857c`, `#0e1412`). Un gris pur posé à côté paraît violet par contraste.

`--surface-2` et `--tint` portent la même valeur : la maquette n'en fait qu'un.
Les deux noms sont conservés parce qu'ils disent des choses différentes (fond
creusé d'un contrôle vs survol) et pourraient diverger.

### États

Trois paliers, pas deux : `--pos` / `--warn` / `--neg`, chacun avec son fond
doux (`--pos-soft`, etc.). L'ambre n'est pas dans la maquette d'origine ; il a
été ajouté parce que les Commandes ont trois seuils de rentabilité et que les
écraser en deux perdait l'information.

En thème sombre, les fonds doux sont des **teintes du fond**, pas des pastels
éclaircis : sur `#0b0e0d` un pastel clair brûle la hiérarchie.

---

## Typographie

**Une seule police d'interface : Space Grotesk.** Des micro-libellés aux
chiffres héros. Pas de police de titrage séparée.

**Une police de chasse fixe : JetBrains Mono.** Elle n'est pas décorative, elle
est fonctionnelle. Elle porte :

- les SKU, montants et coefficients du Stock (c'est elle qui aligne les colonnes
  de chiffres à l'œil sur 1 200 lignes) ;
- les micro-libellés de section (`Eyebrow`), en `10.5px` avec
  `tracking-[0.2em]` ;
- les codes courts de la sidebar repliée, en `8.5px`.

Les pages qui ne posent pas `font-mono` ne la chargent pas.

### Échelle réelle

Direction C travaille au demi-pixel. L'échelle Tailwind ne sait pas exprimer
10,5 / 12,5 / 13,5, donc **le code utilise des valeurs arbitraires**
(`text-[13.5px]`), et c'est assumé, pas un accident.

Les tailles effectivement présentes, par fréquence :

| Taille | Rôle |
|---|---|
| `12.5px` | libellé courant, le plus fréquent du produit |
| `13.5px` | corps de texte des contrôles et des lignes |
| `14px` | corps de texte des formulaires et boutons |
| `13px` / `12px` | métadonnées, cellules denses |
| `11px` / `10.5px` / `10px` | micro-libellés, en mono le plus souvent |
| `9.5px` / `9px` / `8.5px` | mentions légales, codes de rail, badges |
| `15px` | titre de carte (`CardTitle`, 600) |
| `17px` – `20px` | titres de section |
| `26px` – `38px` | chiffres héros |

Graisses : `500` pour un libellé, `600` pour un titre, `700`/`bold` pour un
chiffre ou un bouton d'accent. Le contraste de hiérarchie passe par la graisse
et la couleur d'encre (`--ink` → `--ink2` → `--faint`), pas par la taille seule.

`tracking` : `-0.02em` sur le wordmark et les gros titres, `-0.01em` sur les
titres de carte, `+0.2em` sur les micro-libellés mono en capitales.

---

## Mise en page

**Sidebar fixe repliable + contenu fluide.**

- Sidebar desktop : `w-[var(--sidebar-w)]`, `236px` déployée, `76px` repliée.
  L'état vit dans `localStorage["myflip-sidebar"]` et est posé sur
  `<html data-sidebar>` avant le premier paint, comme le thème.
- Le contenu suit avec `md:pl-[var(--sidebar-w)]` (`components/AppShell.tsx:26`)
  et une transition de padding de 200 ms.
- Repliée, la sidebar ne montre pas des lignes rognées : chaque item devient un
  **jeton carré de 48px**, icône au-dessus, code mono en dessous. C'est la
  signature de Direction C — le rail reste lisible sans survol.
- Mobile (`< 768px`) : sidebar masquée, **bottom nav** fixe, `env(safe-area-inset-bottom)`.

**Le point de bascule des grilles est `min-[900px]:`**, ni `md:` (768) ni `lg:`
(1024). C'est celui de la maquette. Le `md:` reste réservé à la bascule
mobile/desktop structurelle (sidebar, tableaux → cartes).

Conteneur de page : `p-[14px]`, `gap-[14px]`, `p-[18px]` à partir de 900px.

---

## Profondeur et formes

La profondeur vient de **l'empilement tonal et des filets**, pas des ombres.

| Niveau | Traitement |
|---|---|
| Fond de page | `--bg`, aplat |
| Module | `--surface` + filet `1px --border`, **pas d'ombre** |
| Fond creusé | `--surface-2` (contrôles, en-têtes de tableau) |
| Élévation d'un cran | `--raise` (ligne sélectionnée, jeton) |
| Survol d'un contrôle | filet `--border-strong` |
| Élément flottant | `--shadow` (modales, popovers, bouton de repli) |

Rayons réellement utilisés, du plus grand au plus petit : `26px` (module),
`22px` (carte), `16px`, `15px`, `14px`, `13px` (jeton d'accent, bouton icône),
`11px`, et `rounded-full` — de loin le plus fréquent, pour les pastilles,
avatars, badges et boutons pilules.

---

## Composants

### Primitives partagées — `components/console.tsx`

Le Dashboard et les Statistiques posaient les mêmes chaînes de classes au
demi-pixel près. Quatre primitives les portent maintenant :

- `Frame` — conteneur de page (colonne, padding, gouttière, `stepIn`).
- `Module` — coquille de section : rayon 26, `--surface`, filet `--border`. Le
  padding passe en `className` parce que la maquette alterne 16/18/20/22/24 px
  selon la densité. `overflow-hidden` doit sauter dès qu'un module contient un
  tableau à défilement horizontal.
- `Eyebrow` — micro-libellé mono `10.5px`, `tracking-[0.2em]`, `--faint`.
- `CardTitle` — titre `15px/600` avec `aside` mono facultatif.

### Boutons

- **Accent** : `bg-[var(--acc)] text-[var(--acc-ink)]`, `font-bold`, rayon plein
  ou `13px` selon le contexte, `hover:bg-[var(--acc-hover)]`.
- **Secondaire** : `--surface` + filet `--border`, texte `--ink`,
  `hover:border-[var(--border-strong)]`.
- **Bouton icône** : carré `44×44` minimum, rayon `12px`, filet `--border`.

Tout élément cliquable fait **44px de haut minimum** (Apple HIG). C'est une
contrainte du produit, pas une suggestion : l'app est utilisée au pouce.

### Statuts — `lib/statutColors.ts`

Dix statuts, chacun avec une **couleur unique** (`color`) et une paire pastel
(`bg`/`ink`) réservée au badge plein. Un statut absent de la table retombe sur
le gris `#9AA79F` de `FALLBACK`.

Les teintes sont réparties sur la roue à dessein, pas choisies une par une : le
magenta de « En lavage » a remplacé un cyan qui, à 8px dans la légende du donut,
ne se distinguait plus du vert de « Vendu » (36° d'écart de teinte mais la même
clarté).

`color` est LA couleur du statut : filet de la colonne SKU, pastille des chips,
texte du sélecteur, segments et légende du donut. Une seule valeur par statut,
pour que le même statut ait la même couleur d'un écran à l'autre.

Les valeurs sont des **littéraux hex en style inline**, pas des classes Tailwind
dynamiques : le JIT ne compile pas `bg-[${x}]` en production sur Vercel.

⚠️ **Réserve d'accessibilité assumée.** Ces teintes sont calibrées pour le fond
graphite du thème sombre. En texte sur fond clair, elles plafonnent entre 1,7:1
et 2,9:1 là où WCAG AA demande 4,5:1. C'est un choix produit (fidélité à la
maquette) ; en contrepartie, **le statut n'est jamais porté par la seule
couleur** — toujours doublé d'un libellé, d'une forme ou d'une position.

### `StatutPill`

Un `<select>` natif déguisé en pastille, délibérément : la liste déroulante
native s'affiche hors du flux DOM, là où un menu custom serait rogné par le
conteneur virtualisé du Stock et perdrait la navigation clavier.

**Largeur fixe : 140px en `sm`.** La maquette aligne une colonne de contrôles,
elle ne fait pas des badges qui se resserrent sur leur texte. En `md` (carte
mobile) : `44px` de haut, pleine largeur.

### `Loader`

Un seul état de chargement dans tout le produit : le logo M monoline qui se
dessine (`atlas-draw` + `atlas-dots`). Props `label` et `size` (`sm` | `md`).
**Il n'y a plus de skeleton ni de spinner** — tout état de chargement passe par
`<Loader>`.

### Tableaux

Interdits sur mobile. Le motif est obligatoire :

```tsx
<div className="hidden md:block">{/* tableau */}</div>
<div className="md:hidden">{/* cartes */}</div>
```

Les lignes se séparent par du blanc et des filets, jamais par des fonds
alternés.

---

## Mouvement

28 keyframes dans `app/globals.css`, toutes courtes (0,2 s à 0,3 s) et
presque toutes en entrée. Les familles :

- **Entrée de bloc** : `fadeUp`, `stepIn`, `cellPop`, `rowIn`, `gridFadeUp/L/R`.
- **Apparition d'élément** : `pop`, `popIn`, `zoomCardIn`, `modalIn`, `tipIn`.
- **Données** : `growBar`, `drawLine` (tracé de courbe).
- **Attention** : `pulseBadge`, `pulseDot`, `pulseRing`.
- **Ambiance** : `drift`, `driftB`, `twinkle`, `sheen`, `floatGlow` — landing
  uniquement.
- **Célébration** : `confettiFly` (vente validée, cf. `lib/celebrate`).

Courbe signature du repli et des modales :
`cubic-bezier(.22, 1, .36, 1)`. Curseur de la sidebar :
`cubic-bezier(.34, 1.4, .5, 1)` (léger dépassement).

**`prefers-reduced-motion`** est respecté par une durée quasi nulle
(`0.01ms !important`), pas par `animation: none`. C'est délibéré : les éléments
qui n'existent visuellement qu'à leur état final (cartes en `fadeUp`, barres en
`growBar`, modales) resteraient invisibles avec `none`. Les composants qui ont
besoin d'aller plus loin lisent la media query en JS — c'est le cas de la frise
SKU de la landing.

---

## Écarts connus entre les tokens et le code

Le 09/08/2026, `tailwind.config.ts` décrivait encore Forest Precision : quatorze
tokens morts, et quatre alias vivants (`primary`, `primary-dark`, `on-primary`,
`error`) figés sur des hex de l'ancienne palette. Ils ont été supprimés ou
rebranchés sur les variables de thème le même jour. Reste ceci :

| Où | Écart | Pourquoi c'est resté |
|---|---|---|
| `public/logo-atlas/*.svg` | Embarquent `#1B4332` / `#A8D5B5` en dur. | Plus utilisés dans la sidebar pour cette raison (`components/Sidebar.tsx:149`), mais toujours servis comme favicon et icône iOS, où ils s'affichent sur le fond du système et non sur celui de l'app. Les refaire suppose de redessiner le pack. |
| `--alert` / `--notice` | Identiques en clair et en sombre. | Choix assumé, comme la table des statuts : un badge de sévérité doit se reconnaître à la même couleur d'un thème à l'autre. Leurs fonds (`--alert-soft` `#fbeee7`) restent donc des pastels clairs y compris dans le panneau sombre de la cloche. |
| `lib/statutColors.ts` | Dix teintes littérales, hors système de thème, contraste 1,7:1 à 2,9:1 en texte sur fond clair. | Fidélité à la maquette, compensée par le fait qu'un statut n'est jamais porté par la seule couleur. Détaillé plus haut. |
| `borderRadius.card` = 20px | Direction C prescrit 22px pour une carte, 26px pour un module. | 7 usages, écart de 2px invisible. À reprendre le jour où ces 7 appels migrent vers `rounded-[22px]`. |

**La règle qui reste vraie :** tout alias de couleur de `tailwind.config.ts`
pointe sur une variable CSS, sans exception. Y écrire un hex, c'est fabriquer le
prochain écart de cette table.
