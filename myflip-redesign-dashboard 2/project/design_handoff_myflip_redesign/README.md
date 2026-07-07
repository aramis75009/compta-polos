# Handoff : Redesign MyFlip (8 pages)

## Overview
MyFlip est un SaaS personnel de comptabilité pour la revente de vêtements de marque (Polo Ralph Lauren, Lacoste, Tommy Hilfiger, Adidas) sur Vinted et Vestiaire Collective. Ce bundle contient le **redesign complet** de l'application : Dashboard, Stock, Mise en vente (wizard 4 étapes), Calendrier, Commandes, À comptabiliser, Statistiques, Paramètres. Couleur de marque conservée : vert forêt `#1B4332`.

## À propos des fichiers de design
Les fichiers de ce bundle sont des **références de design réalisées en HTML** — des prototypes qui montrent l'apparence et le comportement attendus, **pas du code de production à copier tel quel**. Ils sont écrits comme des « Design Components » (un format de prototypage à template + classe logique) ; **ne reprends pas ce format**.

La tâche est de **recréer ces designs dans l'environnement existant de MyFlip** : **Next.js 14 (App Router), Tailwind CSS, Prisma + Neon PostgreSQL**. Utilise les conventions et composants déjà en place dans ce codebase (layouts, composants serveur/client, data layer Prisma). Les données affichées dans les prototypes sont des **valeurs d'exemple** ; branche les vraies données via les requêtes existantes.

## Fidelity
**Haute fidélité (hifi).** Couleurs, typographies, espacements, rayons et interactions sont définitifs. Recrée l'UI au pixel près avec Tailwind. Les nombres sont illustratifs — seul l'agencement visuel fait foi.

---

## Système de design (design tokens)

### Couleurs
| Rôle | Hex |
|---|---|
| Vert marque (primary) | `#1B4332` |
| Vert hover / foncé | `#143528` |
| Vert medium (dégradés, accents) | `#2D6A4F` |
| Vert clair accent (sur fond foncé) | `#9FD4B5` / `#7CE0A8` |
| Vert pâle (barres, donut) | `#B7D3C2` / `#52B788` |
| Fond app | `#EEF1EC` |
| Surface carte | `#FFFFFF` |
| Bordure carte | `#E4E9E2` |
| Fond doux / hover ligne | `#F7F9F6` / `#F1F4EF` |
| Texte principal | `#16261D` |
| Texte secondaire | `#71807A` |
| Texte muted / labels | `#8A998F` / `#94A29A` |
| Pill positif (succès) | fond `#E4F3EA` / `#E7F4EC`, texte `#2D6A4F` |
| Pill négatif | fond `#FBEEE7`, texte `#B5613B` |
| Bleu « En vente » | fond `#E7F0FF`, texte `#3B6FD4` |
| Canal Vinted | `#0BBBC4` (foncé `#089AA2`), pill fond `#E2F7F8` texte `#0892A0` |
| Canal Vestiaire | `#16261D`, pill fond `#ECEEF0` texte `#2B3942` |
| Dégradé orange (projection longue) | `#E0A06B` → `#C2603F` |
| Headers calendrier (jours) | `#B58A4A` (ambre) |

### Coefficient — code couleur (calendrier, stock, marques)
- `≥ 2,3×` → vert (texte `#2D6A4F`, fond `#E4F3EA`)
- `2,0×–2,29×` → ambre (texte `#B5872E`, fond `#FBF3E2`)
- `< 2,0×` → rouge (texte `#C2603F`, fond `#FBEEE7`)

### Typographie
- **Chiffres / titres / display** : `Space Grotesk` (Google Fonts), weights 400–700, `letter-spacing: -0.02em` à `-0.03em` sur les gros nombres.
- **Corps / UI** : `Plus Jakarta Sans` (Google Fonts), weights 400–800.
- Échelle gros KPI : hero CA ≈ 62px ; KPI cartes 36–40px ; titres de section 18–19px ; labels uppercase 11,5–12,5px (700, letter-spacing .04–.05em).

### Rayons & ombres
- Rayons : cartes 20–22px ; KPI/petites cartes 16–18px ; pills 18–20px ; cellules calendrier 13px ; boutons 12–13px ; icône-conteneur 11–14px.
- Ombre carte hover : `0 14px 30px -22px rgba(20,53,40,.5)`.
- Ombre hero : `0 18px 40px -22px rgba(20,53,40,.7)`.
- Ombre bouton primaire : `0 10px 22px -12px rgba(20,53,40,.8)`.

### Espacements
- Padding contenu principal : `30px 38px 46px`.
- Gaps grilles : 18–20px ; gaps internes cartes 12–22px.

### Animations
- Entrée sections : `fadeUp` (translateY 14px → 0, opacity 0 → 1), ~0.45–0.5s, délais échelonnés .06s.
- Barres de graphe : `growBar` (scaleY 0 → 1, origin bottom), 0.7–0.75s `cubic-bezier(.2,.85,.25,1)`, délai `index*0.06s`.
- Donut : `dashIn` (stroke-dashoffset → valeur), ~1s.
- Ligne (Commandes) : `drawLine` (stroke-dashoffset 1200 → 0), 1.4s.
- Spinner génération : `spin` 0.9s linéaire infini + `pulseRing`.

---

## Icônes
Toutes les icônes sont des **Lucide** (style line, stroke-width 2). Utilise `lucide-react`. Correspondances : Dashboard=`LayoutDashboard`, Stock=`Package`, Mise en vente=`Tag`, À comptabiliser=`FileText`, Calendrier=`Calendar`, Commandes=`ShoppingBag`, Statistiques=`BarChart3`/`TrendingUp`, Paramètres=`Settings`, Déconnexion=`LogOut`, marge=`HandCoins`-like (€), check=`Check`, deltas=`TrendingUp`/`TrendingDown`, génération=`Sparkles`, refresh=`RotateCw`.

---

## Layout global (toutes les pages)
- **Sidebar fixe à gauche**, largeur `256px`, fond blanc, bordure droite `#E4E9E2`, padding `26px 18px 22px`.
  - Logo : carré `38px` rayon 11px fond `#1B4332` lettre « M » blanche + wordmark « MyFlip » (Space Grotesk 700, 20px).
  - Libellé de groupe « PILOTAGE » (11px, 700, letter-spacing .09em, `#9BA89F`).
  - Items nav : `padding 11px 13px`, rayon 12px, gap icône-texte 13px, 14,5px.
    - **Actif** : fond `#1B4332`, texte blanc, weight 600.
    - **Inactif** : texte `#52635A`, weight 500 ; hover fond `#F1F4EF` texte `#1B4332`.
  - Ordre : Dashboard, Stock, Mise en vente, À comptabiliser, Calendrier, Commandes, Statistiques, Paramètres. « Déconnexion » poussé en bas (`margin-top:auto`, séparé par une bordure haute).
- **Zone principale** : `flex:1`, scroll vertical, fond `#EEF1EC`.
- **Topbar** (Dashboard/Statistiques/Stock…) : titre (Space Grotesk 700, 30px) + sous-titre `#71807A` à gauche ; à droite chip sélecteur de période (fond blanc, bordure, calendrier+chevron) + avatar rond 42px `#1B4332` initiale « A ».

---

## Écrans

### 1. Dashboard — `Dashboard.dc.html`
**But** : vue d'ensemble immédiate de l'activité.
- **Greeting** : « Bonjour Aramis 👋 » + date du jour en français (`toLocaleDateString('fr-FR', {weekday, day, month, year})`, capitalisée).
- **Hero** (grille `1.55fr 1fr`) : carte vert foncé en dégradé radial `radial-gradient(120% 130% at 88% 8%, #2D6A4F, #1B4332 46%, #143528)`, halo flou animé en haut à droite. Contenu : label « CA TOTAL » + chip période ; sparkline SVG mint ; **nombre géant** « 12 642,92 € » (Space Grotesk 700, 62px) ; pill « +15,4 % » (mint translucide) + « vs mois dernier · +1 689 € ».
- **Carte Marge nette** (à droite du hero) : label, nombre 40px, icône €, pill delta « +9,8 % » + « marge moyenne 48,8 % ».
- **2 KPI cards** (`1fr 1fr`) : « Articles en stock » (352 / 1 243 au total, icône Package, pill négatif −6,2 %) ; « Taux de vente » (anneau SVG 33%, 416 vendus, pill +4,1 %).
- **Graphe « CA par semaine »** : 8 barres verticales (vert pâle, meilleure semaine en `#1B4332`, hover `#2D6A4F`), **tooltip au survol** (pill `#16261D`, CA + libellé semaine), gridlines pointillées, animation d'entrée échelonnée. Données ex. : 4 mai→15 juin, max 4 200 €.
- **« Par marque »** : grille `2×2` de cartes — initiales sur carré vert, nom, « X en stock · Y vendus », pill coef, CA (Space Grotesk 28px), « Z € de marge », **barre de progression** « Taux de vente » (dégradé `#2D6A4F→#1B4332`). 4 marques (Polo Ralph Lauren, Tommy Hilfiger, Lacoste, Adidas).
- **Tweaks/props** : `period` (enum), `showDeltas` (bool), `highlightBest` (bool). À mapper en filtres réels ou props de composant.

### 2. Stock — `Stock.dc.html`
**But** : tableau opérationnel des articles.
- **Header** : titre + boutons « Colonnes », « Exporter CSV », « + Nouvelle commande » (primaire).
- **Barre de stats** (`4×`) : Articles au total (1 243), En vente (475, icône bleue), Vendus (416, check vert), **Valeur du stock** (3 214,56 €, carte verte foncée pleine).
- **Filtres** : recherche SKU + 3 dropdowns (marques, statuts, commandes).
- **Tableau** carte arrondie. Colonnes : checkbox, SKU (Space Grotesk 700), Marque, Catégorie, **Statut** (pill : Vendu=vert, En vente=bleu), Prix achat (droite), Marge (droite, 700), Coef (droite), **Canal** (pill avec pastille : Vinted teal / Vestiaire charcoal), Actions (éditer / supprimer). Lignes `padding 15px 22px`, bordure basse `#EEF1EC`, hover fond doux. Row height aéré.

### 3. Mise en vente — `Mise en vente.dc.html`
**But** : wizard 4 étapes pour générer une annonce (Gemini Flash).
- **Stepper** horizontal, 4 cercles 40px reliés par des barres 3px. États : *done* (fond vert, check blanc), *active* (fond vert + halo `0 0 0 5px #E1ECE4`), *todo* (blanc, bordure, n° gris). Connecteur vert si étape franchie.
- **Étape 1 — Photos** : carte SKU (champ + bouton « Vérifier », puis ligne récap SKU/En stock/Marque/Catégorie) ; zone de dépôt en pointillés (icône upload, « Glisse tes photos ici », bouton « Parcourir ») ; aperçus 3 photos numérotés (badge n°, bouton supprimer, nom de fichier). Footer : Annuler / **Continuer**.
- **Étape 2 — Détails** : layout 2 colonnes (`300px 1fr`). Gauche : miniatures photos + case d'ajout. Droite : grille `2×2`+ de selects (Marque, Catégorie, Taille, État, Matière, Matière 2) en style « faux select » (bordure, chevron) + textarea « Prompt complémentaire ». Footer : Retour / **Générer l'annonce** (icône Sparkles).
- **Étape 3 — Génération (écran de chargement animé)** : carte centrée. Spinner double anneau (`spin`) + pastille verte pulsée (Sparkles). Titre « Génération en cours… » + « MyFlip rédige ton annonce avec Gemini Flash ». **Checklist animée** de 5 messages qui défilent (« Analyse des photos… » → « Identification de la marque… » → « Rédaction de l'annonce… » → « Optimisation des mots-clés… » → « Finalisation… ») : item *done* = pastille verte + check, *active* = pastille `#2D6A4F` + point pulsé, *à venir* = gris. Avance automatiquement (~1,25s par étape) puis passe à l'étape 4. **À l'implémentation, piloter ces états sur la vraie progression de l'appel Gemini.**
- **Étape 4 — Export** : bandeau succès vert ; carte résultat avec Titre (Space Grotesk 18px), Prix suggéré (vert 24px), Description (textarea pré-remplie, fond `#F9FBF8`), tags `#hashtag`. Footer : « Nouvelle annonce » (reset) + boutons **Publier sur Vinted** (teal) / **Vestiaire** (charcoal).
- **State** : `step` (1–4), `genIndex` (0–4). Transitions : `next`/`back`/`restart` ; un `setInterval` fait défiler `genIndex` en étape 3, puis `setStep(4)`.

### 4. Calendrier — `Calendrier.dc.html`
**But** : ventes jour par jour, récap hebdo, détail au clic.
- **Header** : titre + nav (chevron gauche / « Aujourd'hui » / chevron droite). Sous-titre + ligne de légende (Vente / Forte journée / 👑 Meilleur jour).
- **Titre de mois** « Juin 2026 » (Space Grotesk 21px).
- **Layout** : flex — grille calendrier (`flex:1`) + **panneau latéral** 300px.
- **Grille** : colonnes `repeat(7,1fr) 1.05fr` (7 jours Lun→Dim + colonne RÉCAP). Headers jours en ambre `#B58A4A`, header RÉCAP en vert.
  - **Cellule jour** (min-height 94px, rayon 13px) : n° (Space Grotesk 700) + 👑 si meilleur jour de la semaine ; si vente → **CA en gras**, ligne « NET xx,xx € », ligne « N art. ». Heatmap : CA ≥ 70 € → fond `#C9E3D2` ; CA > 0 → `#E4F1E9` ; sans vente → `#F7F9F6` ; hors mois → transparent texte gris. **Aujourd'hui** (24) : n° dans pastille verte + `inset 0 0 0 2px #1B4332` sur la cellule. Jour avec vente = cliquable.
  - **Cellule RÉCAP** (par semaine) : bordure gauche verte 3px ; label « CA » + montant gras ; sous-ligne « X art. · NET Y € » ; pill **coef** (couleur selon barème) + **panier moyen** avec icône panier.
- **Panneau latéral** : par défaut empty state (icône calendrier + « Clique sur un jour avec des ventes pour voir le détail »). Au clic sur un jour : carte détail — date, bloc CA (dégradé vert), lignes Marge nette / Articles vendus / Taux de marge (= NET/CA), bouton fermer.
- **Bande « Total du mois »** (bas, pleine largeur) : 5 métriques séparées par des séparateurs verticaux — **CA TOTAL** 621,36 € · **ARTICLES VENDUS** 37 · **MARGE NETTE** 313,33 € (vert) · **COEF MOYEN** 2,18× · **PANIER MOYEN** 16,79 €. Chiffres en Space Grotesk 26px.
- **Données exactes à conserver** (jour : CA / NET / art.) :
  - S1 : 1→48,16/26,97/3 · 2→15,47/6,36/1 · 3→24,90/15,20/1 · 4→14,50/0,00/1 · 6→97,71/66,56/5 👑 · 7→18,47/12,39/1 — Récap : 219,21 € · 12 art. · NET 127,48 € · 2,62× · 18,27 €
  - S2 : 9→44,17/31,85/2 👑 · 11→21,46/7,92/2 · 13→24,70/14,43/1 — Récap : 90,33 € · 5 art. · NET 54,21 € · 3,13× · 18,07 €
  - S3 : 17→41,71/18,19/3 · 18→80,44/32,04/5 👑 · 19→21,67/14,20/1 · 20→36,69/16,10/3 · 21→66,11/25,98/4 — Récap : 246,62 € · 16 art. · NET 106,51 € · 2,04× · 15,41 €
  - S4 : 22→29,49/10,69/3 · 23→35,71/14,44/1 👑 · 24 = aujourd'hui (sans vente) — Récap : 65,20 € · 4 art. · NET 25,13 € · 1,78× · 16,30 €
  - S5 : 29, 30 sans vente ; 1–5 hors mois (grisés) — Récap : 0,00 € · 0 art. · 0,00× · 0,00 €

### 5. Commandes — `Commandes.dc.html`
**But** : achats en lot, groupés par fournisseur.
- **Header** : titre + « Importer un Excel » + « + Nouvelle commande ».
- **3 KPI cards** : **Total investi** (8 740,30 €, carte verte dégradée), Commandes passées (18, icône), Prix unitaire moyen (9,12 €).
- **Graphe linéaire** « Investissements dans le temps » : SVG aire + ligne `#1B4332` (animation `drawLine`), points, point culminant plein, labels mois Janv→Juin.
- **« Par fournisseur »** : grille `2×2` de cartes — initiales carré vert, nom, « Dernier achat · date », pill « X cmd » ; bloc 3 stats (Coût total, Articles, Prix unit.). Fournisseurs ex. : Grossiste Lyon, Destockage Paris, Friperie Marseille, Vinted Pro.

### 6. À comptabiliser — `À comptabiliser.dc.html`
**But** : ventes en attente de saisie comptable (sync automatique).
- Titre **noir** (cohérent avec les autres pages — ne pas remettre en rouge).
- **3 KPI cards** : Ventes en attente (0, vert), Ventes comptabilisées (416), Dernière synchronisation (« il y a 2 h »).
- **Empty state** : grand cercle dégradé vert avec check (animation `pop`), « Tout est à jour ! » (Space Grotesk 24px), texte « Aucune vente n'attend d'être comptabilisée. Les nouvelles ventes apparaissent ici automatiquement dès leur synchronisation. » **Pas de bouton** (sync automatique).
- Quand des éléments sont en attente : afficher un **badge rouge** avec le nombre sur l'item « À comptabiliser » de la sidebar.

### 7. Statistiques — `Statistiques.dc.html`
**But** : analyse de performance.
- **2 cartes dégradées** : **Vitesse de vente** (dégradé vert `135deg #2D6A4F→#1B4332`, « 3,4 ventes/jour », icône éclair, footer Moyenne 7 j / 30 j) ; **Projection d'écoulement** (dégradé orange `#E0A06B→#C2603F` car > 365 j, « 507 jours », icône horloge, **barre de progression** « 33 % du stock écoulé · 416 / 1 243 »).
- **« Meilleur jour de la semaine »** : barres par jour (Lun→Dim), champion (Mercredi) en vert vif, autres en pâle, tooltip au survol, badge « 🏆 Mercredi ».
- **« Répartition des statuts »** : donut SVG 3 segments (Vendu 416 / 33 % `#1B4332` ; En vente 475 / 38 % `#52B788` ; En stock 352 / 28 % `#B7D3C2`), centre « 1 243 articles », légende lisible (pastille + libellé + valeur + %).
- **« CA par canal »** : 2 barres horizontales — Vinted (8 420,15 € / 67 %, teal) ; Vestiaire Collective (4 222,77 € / 33 %, charcoal). Total 12 642,92 €.
- **Props** : `period` (enum), `highlightChampion` (bool).

### 8. Paramètres — `Paramètres.dc.html`
**But** : modèles de prompts de génération + compte.
- **Header** : titre + « + Nouveau prompt ».
- **Ligne compte** (`1.4fr 1fr 1fr`) : carte profil (avatar + Aramis + email), Marge cible (45 %), Modèle IA (Gemini Flash).
- **« Modèles de prompts »** : grille `2×2` de cartes — **badge marque coloré** (Polo=vert, Tommy=teal, Lacoste=charcoal, Adidas=terracotta) + catégorie, badge « ✓ Par défaut » (vert) sur le prompt par défaut, titre, aperçu du prompt (3 lignes max, `line-clamp`), footer « Utilisé N fois » + boutons Modifier / supprimer.

---

## Interactions & comportement à reproduire
- **Navigation sidebar** : route active mise en évidence (fond vert). Dans les prototypes, les liens pointent vers les autres fichiers `.dc.html` — à remplacer par le routing Next.js (`<Link>` vers `/stock`, `/calendrier`, etc.).
- **Hover** : cartes (bordure + ombre douce), lignes de tableau (fond doux), boutons (assombrissement), items nav.
- **Graphes** : tooltip au survol des barres (Dashboard, Statistiques) ; animations d'entrée à respecter.
- **Calendrier** : clic sur un jour vendu → ouvre/maj le panneau latéral ; bouton fermer → empty state.
- **Mise en vente** : machine à états 4 étapes ; étape 3 = chargement piloté par la progression réelle de l'appel Gemini (les messages défilants sont un placeholder UX).

## State management
- **Dashboard / Statistiques** : filtre `period` ; flags d'affichage (deltas, highlight).
- **Stock** : recherche SKU, filtres (marque/statut/commande), sélection multi-lignes, édition inline (double-clic cellule — comportement existant à conserver).
- **Mise en vente** : `step` (1–4), données du formulaire, état de génération (`loading`/`done`), résultat (titre/description/prix/tags).
- **Calendrier** : mois courant, `selectedDay` (détail panneau).
- Données réelles via Prisma/Neon ; les valeurs des prototypes sont des exemples.

## Assets
- **Polices** : Space Grotesk + Plus Jakarta Sans (Google Fonts) — via `next/font/google`.
- **Icônes** : `lucide-react`.
- **Images produit** : les zones rayées (placeholders) représentent les photos d'articles uploadées par l'utilisateur — à remplacer par les vraies images du stock.
- Aucun asset binaire à fournir : tout est CSS/SVG inline.

## Files (références dans ce bundle)
- `Dashboard.dc.html`
- `Stock.dc.html`
- `Mise en vente.dc.html`
- `Calendrier.dc.html`
- `Commandes.dc.html`
- `À comptabiliser.dc.html`
- `Statistiques.dc.html`
- `Paramètres.dc.html`

> Ouvre chaque fichier dans un navigateur pour voir le rendu et les interactions. Le markup utile est entre `<x-dc>` et `</x-dc>` ; la logique est dans la classe `Component` du `<script>`. **Recrée ces écrans avec les composants/Tailwind du projet — ne porte pas le format Design Component.**
