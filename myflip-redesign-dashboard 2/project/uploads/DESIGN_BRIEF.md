# MyFlip — Brief de redesign pour Claude Design

## Le projet

**MyFlip** est une application SaaS personnelle de comptabilité pour la revente de vêtements de marque (Polo Ralph Lauren, Lacoste, Tommy Hilfiger, Adidas) sur Vinted et Vestiaire Collective. Utilisée au quotidien par une seule personne (Aramis) pour piloter son activité de reselling : achat en lot, mise en vente avec génération d'annonces IA (Gemini Flash), suivi des ventes, comptabilité.

**Stack technique :** Next.js 14 App Router, Tailwind CSS, Prisma + Neon PostgreSQL.

**Couleur principale :** Vert forêt foncé `#1B4332` (dark green-800). À conserver comme identité de la marque.

---

## Pages existantes (à redesigner)

### 1. Dashboard — Priorité 1

**État actuel :**
- 4 KPI cards en ligne : CA Total (fond vert foncé), Marge Nette, Articles en stock, % Vendu
- Graphique en barres "CA par semaine" (8 semaines, barres vert foncé uniforme)
- Tableau "Par marque" en bas (marque, total, en stock, vendus, CA, marge nette, coef moyen, panier moyen, % vendu)

**Problèmes :**
- Les 4 KPI cards sont de même taille → pas de hiérarchie visuelle
- Pas de salutation personnalisée
- Les barres du graphique n'ont pas de tooltips visibles
- Le tableau Par marque est trop dense, pas de séparation visuelle claire
- Trop de blanc vide entre les sections

**Direction souhaitée :**
- Inspiration **Sequence** : gros bloc hero en vert foncé en haut avec le CA total en très grand (genre "12 642,92 €" énorme + "+ 15% ce mois"), puis les autres KPIs en cartes dessous
- Inspiration **Donezo** : typo très grande pour les chiffres clés, une card principale hero
- Inspiration **Logip** : "Bonjour Aramis," en titre personnalisé + date du jour
- Garder le graphique barres mais avec tooltips au hover et animation d'entrée
- Tableau Par marque : transformer en cartes par marque avec mini progress bar (comme Shopeers "Best Selling Products") plutôt qu'un tableau brut

---

### 2. Stock — Priorité 2

**État actuel :**
- Barre de filtres en haut (recherche SKU, dropdown marque, dropdown statut, dropdown commande)
- Tableau dense : SKU, Marque, Catégorie, Statut (badge coloré), Prix achat, Marge nette, Coef, Canal (badge Vinted/Vestiaire), Actions
- Boutons "Colonnes", "Exporter CSV", "+ Nouvelle commande" en haut à droite

**Problèmes :**
- Tableau très dense, lignes serrées, peu d'espace
- Les badges de statut (Vendu = vert, En vente = bleu) sont bien mais pourraient être plus lisibles
- Pas de résumé stats en haut du stock

**Direction souhaitée :**
- Ajouter une mini barre de stats au-dessus du tableau : X articles au total · X en vente · X vendus · Valeur stock = Y€
- Augmenter le row height et l'espacement
- Badges statut : arrondi pill style, couleurs plus douces
- Badges canal (Vinted/Vestiaire) : icons + couleur propre à chaque plateforme

---

### 3. Mise en vente (wizard 4 étapes) — Priorité 3

**État actuel :**
- Stepper horizontal : Photos → Détails → Génération → Export
- Étape 1 : champ SKU + bouton "Vérifier", puis drop zone photo simple
- Étape 2 : photos sélectionnées + formulaire (Marque, Catégorie, Taille, État, Matière, Matière 2, Prompt)
- Design très minimaliste, beaucoup de blanc vide

**Problèmes :**
- La page step 1 vide (juste un champ texte) semble incomplète visuellement
- La drop zone de photos est très basique (icône générique + texte)
- Le stepper est fonctionnel mais visuellement plat

**Direction souhaitée :**
- Stepper : lignes de connexion entre étapes animées, numéros dans des cercles colorés
- Step 1 : centrer le champ SKU dans une card plus visible avec illustration ou icône stylée
- Drop zone photos : animation de drag-over, preview des photos en grille 3×1 avec numéros
- Step 2 : layout 2 colonnes (photos à gauche, formulaire à droite) pour éviter le défilement

---

### 4. Calendrier — Priorité 4

**État actuel :**
- Navigation mois avec ← Précédent / Aujourd'hui / Suivant →
- Grille 7 jours + colonne "Récap semaine"
- Jours avec ventes : fond vert clair (bg-green-100)
- Headers jours en orange (text-amber-600)
- Couronne 👑 sur le meilleur jour de chaque semaine
- Jour actuel : cercle vert sur le numéro
- Jours hors mois : gris clair
- Panneau latéral droit au clic sur un jour

**État :** Déjà bien amélioré — changements cosmétiques légers seulement

**Direction souhaitée :**
- Les boutons de navigation (Précédent / Suivant) pourraient être des icônes chevron sans texte sur mobile
- Le récap semaine pourrait avoir une légère ombre ou un border-l plus visible pour le séparer
- Couleur verte des jours vendus : tester un dégradé subtil selon le CA (plus vert = plus de CA) plutôt qu'uniforme — mais seulement si ça reste lisible

---

### 5. Statistiques — Priorité 2 (égale avec Stock)

**État actuel :**
- 2 cards en haut : "Vitesse de vente" (moyenne 7j / 30j) + "Projection" (jours restants en grand)
- "Meilleur jour de la semaine" : titre + graphique barres par jour
- "Répartition des statuts" : donut chart coloré
- Section "CA par canal" (hors scroll)

**Problèmes :**
- Les 2 cards "Vitesse" et "Projection" ont des layouts internes différents → incohérents
- "507 j" en projection est énorme mais sans contexte visuel (pas de progress bar, pas de couleur)
- Le donut chart est bien mais la légende est très textuelle
- Pas d'icônes sur les cards

**Direction souhaitée :**
- Inspiration **Kristin dashboard** : utiliser des cards avec fond dégradé pour les KPIs clés (vitesse de vente → dégradé vert, projection → dégradé orange si >365j)
- Ajouter des icônes Lucide sur chaque card
- Projection : ajouter une mini progress bar circulaire ou linéaire "X% vendus"
- Meilleur jour : highlight la barre du jour champion en vert plus vif, les autres en vert pâle

---

### 6. Commandes — Priorité 5

**État actuel :**
- Simple tableau : Fournisseur, Date, Nb art., Coût total, Prix unit., (menu ...)
- Boutons "Importer un Excel" + "+ Nouvelle commande"

**Problèmes :**
- Page très basique, aucune visualisation
- Pas de total visible
- Les lignes du tableau sont très similaires entre elles (même fournisseur)

**Direction souhaitée :**
- Ajouter en haut 3 KPI cards : Total investi, Nb commandes, Prix unitaire moyen
- Grouper les commandes par fournisseur avec une card par fournisseur (comme Shopeers "Customers")
- Ajouter un graphique linéaire "investissements dans le temps"

---

### 7. À comptabiliser — Priorité 5

**État actuel :**
- Titre rouge "À comptabiliser" (la seule page avec titre coloré en rouge — incohérent)
- Tableau vide la plupart du temps

**Problèmes :**
- Titre rouge est incohérent avec le reste (tous les autres titres sont en noir)
- L'état vide "Rien à comptabiliser 🎉" est trop minimal
- Page peu utilisée visuellement

**Direction souhaitée :**
- Passer le titre en noir comme les autres pages
- Empty state : belle illustration ou icône + message "Tout est à jour !" avec un check vert
- Quand il y a des éléments : badge rouge sur l'item de navigation Sidebar pour signaler le nombre en attente

---

### 8. Paramètres / Prompts — Priorité 6

**État actuel :**
- Liste de prompt templates en cards simples
- Bouton "+ Nouveau prompt" en haut à droite

**Direction souhaitée :**
- Cards plus visuelles avec le nom de la marque/catégorie comme badge coloré
- Badge "Par défaut" plus visible (actuellement petit tag vert)

---

## Résumé des inspirations Dribbble

| Source | Élément à emprunter |
|--------|---------------------|
| **Sequence** | Hero section sombre avec grand chiffre financier, date range selector |
| **Donezo** | Grande typo pour les KPIs, accent vert cohérent, time tracker style card |
| **Logip** | Accueil "Bonjour [Prénom]", graphique de performance avec tooltip au hover |
| **Kristin** | Cards avec fond dégradé (gradient) pour certaines métriques clés |
| **Shopeers** | Tableau "meilleurs produits" transformé en section visuelle, badges propres |

---

## Ce qu'il ne faut PAS changer

- La couleur verte foncée `#1B4332` — c'est l'identité de MyFlip
- La structure de la sidebar (navigation fixe à gauche)
- Les noms des pages (Dashboard, Stock, Mise en vente, etc.)
- La logique fonctionnelle de chaque page
- Le stepper 4 étapes de Mise en vente (juste l'habillage)

---

## Pages à traiter en priorité pour Claude Design

1. **Dashboard** — c'est la page vue en premier, l'impact est immédiat
2. **Statistiques** — contenu riche, mérite un meilleur rendu visuel
3. **Stock** — page la plus utilisée au quotidien
4. **Mise en vente** — wizard qui doit être fluide et agréable
5. **Commandes / À comptabiliser** — secondaires

---

## Prompt suggéré pour Claude Design

```
Je veux redesigner MyFlip, mon SaaS personnel de comptabilité pour la revente de vêtements de marque (Polo Ralph Lauren, Lacoste, Tommy Hilfiger, Adidas) sur Vinted et Vestiaire Collective.

La couleur de marque est le vert forêt foncé (#1B4332). Je veux garder cette couleur mais rendre l'interface beaucoup plus moderne, aérée, et visuellement impactante.

Inspirations (voir screenshots joints) :
- Sequence.io : hero section sombre avec le solde en très grand, date range
- Donezo : grande typo pour les KPIs, accent vert, cards visuelles
- Logip : accueil personnalisé "Bonjour Aramis", graphiques avec tooltips
- Dashboard Kristin : cards avec fond dégradé pour certaines métriques

Commence par le Dashboard. Actuellement il a : 4 KPI cards (CA Total en hero vert, Marge nette, Articles en stock, % vendu), un graphique barres CA par semaine, et un tableau Par marque.

Je veux :
1. Un bloc hero en haut (fond vert foncé ou dégradé) avec "Bonjour Aramis" + la date + le CA total en très grand
2. 3 KPI cards dessous (Marge nette, Articles en stock, % vendu) avec icons et variation vs mois précédent
3. Le graphique CA par semaine avec tooltips au hover et animation
4. Le tableau Par marque transformé en cards visuelles avec mini progress bar
```
