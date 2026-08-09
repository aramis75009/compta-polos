# Prompt — Landing page MyFlip

> Fichier de travail, jetable. À coller dans VS Code / Gemini.
> La grille tarifaire ci-dessous est reprise telle quelle dans le prompt.

---

## Rappel de la grille (pour toi, pas pour le modèle)

| Palier | Prix | Cœur de cible |
|---|---|---|
| **Solo** | 9 €/mois TTC | Débute, un seul compte, petit stock |
| **Atelier** | 29 €/mois TTC | Achète en lots — le cœur de cible |
| **Négoce** | 59 €/mois TTC | Volume, multi-comptes, sourcing sérieux |

⚠️ **Trois lignes de la grille décrivent des fonctionnalités qui n'existent pas encore** dans MyFlip : « rotation & stock dormant », « marge par fournisseur » et « frais annexes ». Elles viennent de l'analyse Fripilot et sont réalisables (les deux premières sans migration). Assume-les comme feuille de route, ou retire-les si tu veux une page strictement honnête.

---

# LE PROMPT À COLLER

---

Tu es un designer web et intégrateur front-end. Crée la **landing page commerciale** d'un SaaS français appelé **MyFlip**.

## Format de sortie — impératif

- **Un seul fichier HTML autonome**, tout le CSS dans une balise `<style>` dans le `<head>`.
- **Aucun framework** : pas de Tailwind, pas de Bootstrap, pas de React. HTML et CSS purs.
- Les polices Google Fonts via `<link>` sont autorisées (le fichier sera ouvert en local).
- JavaScript uniquement si nécessaire (menu mobile, accordéon FAQ). Pas de bibliothèque externe.
- **Responsive**, mobile d'abord. Aucun défilement horizontal.
- Accessible : contrastes suffisants, focus clavier visible, balises sémantiques.
- **Pas de lorem ipsum.** Tout le texte doit être du vrai contenu, en français.

## Le produit

MyFlip est un outil de gestion pour les **revendeurs de vêtements de marque d'occasion** qui **achètent en lots** (balles de friperie, déstockage) et revendent à la pièce sur Vinted et Vestiaire Collective.

Leur métier suit toujours le même cycle : acheter un lot chez un fournisseur → trier et attribuer un identifiant unique (SKU) à chaque pièce → laver, repasser, photographier → rédiger l'annonce → vendre → comptabiliser la marge.

Le problème que MyFlip résout : ce cycle se gère aujourd'hui au tableur et au feeling. Le revendeur ne sait pas quel lot lui a vraiment rapporté, quel article dort depuis trois mois, ni combien il a réellement gagné une fois le prix d'achat réparti.

## Le positionnement — important

Les concurrents sont des outils de **comptabilité de vente** : ils partent de la vente et remontent vers la déclaration fiscale.

MyFlip prend le problème par l'autre bout : il part de **l'achat du lot** et suit chaque pièce jusqu'à la vente. C'est l'outil du **sourceur**, pas du comptable. La page doit faire sentir cette différence.

Ton, en français : direct, concret, professionnel. Le lecteur est un commerçant, pas un cadre. Pas de jargon startup, pas de superlatifs creux, pas de « révolutionnez votre business ». On parle chiffres, marge, temps gagné.

## Les fonctionnalités à présenter

1. **Annonces générées par IA depuis vos photos** — Photographiez la pièce, l'IA rédige le titre, la description et les mots-clés, dans votre style. C'est la fonctionnalité phare, celle qu'aucun concurrent n'a. Mettez-la en avant.
2. **Suivi par lot d'achat** — Enregistrez votre commande fournisseur (coût total, nombre de pièces, grade), MyFlip répartit le prix d'achat sur chaque article et compare le coefficient obtenu à votre objectif. Vous savez enfin quel lot valait le coup.
3. **Stock au SKU** — Chaque pièce a son identifiant, son statut et sa marge. Dix statuts qui suivent le vrai cycle : en stock, en lavage, repassé, photos prêtes, en vente, en livraison, vendu.
4. **Marge réelle, pas approximative** — Marge brute, marge nette, coefficient et panier moyen calculés à la pièce, par marque et par lot.
5. **Assistant IA qui agit** — Posez une question sur votre stock, ou demandez-lui de passer trente articles en vente. Il ne se contente pas de répondre, il exécute.
6. **Connecté à votre organisation** — Intégration Trello : une carte étiquetée fait basculer les articles côté MyFlip, et le transporteur est détecté automatiquement.

## Structure de la page

1. **Barre de navigation** — logo MyFlip, liens (Fonctionnalités, Tarifs, Connexion), bouton « Essayer gratuitement ».
2. **Hero** — Une promesse forte en titre, un sous-titre qui explique le cycle achat → vente, deux boutons (essai gratuit, voir les tarifs), et trois mentions rassurantes : 14 jours d'essai gratuit · Sans carte bancaire · Vos données vous appartiennent.
3. **Le problème** — Une section courte qui nomme la douleur : le tableur qui lâche, le prix d'achat jamais réparti, le stock qui dort. Trois ou quatre points, pas plus.
4. **Fonctionnalités** — Les six ci-dessus, en grille. La première (IA) mérite un traitement plus large que les autres.
5. **Comment ça marche** — Trois étapes : *Enregistrez votre lot* → *Triez et photographiez* → *Vendez et pilotez*.
6. **Tarifs** — Les trois paliers ci-dessous. Mettre « Atelier » en avant comme le plus populaire.
7. **FAQ** — Quatre à six questions réelles : Faut-il connecter mon compte Vinted ? (non — MyFlip ne se connecte jamais à Vinted, vous gardez la main, aucun risque pour votre compte) · Puis-je importer mon stock existant ? · Que se passe-t-il après l'essai ? · Mes données sont-elles à moi ?
8. **Appel à l'action final** puis **pied de page** — mentions légales, CGU, confidentialité, © 2026 MyFlip.

## La grille tarifaire — à reprendre exactement

**Solo — 9 €/mois TTC** · 14 jours d'essai gratuit
- 1 compte de vente
- Jusqu'à 100 articles en stock
- Stock, tableau de bord et calendrier des ventes
- 30 annonces générées par IA / mois
- Export CSV

**Atelier — 29 €/mois TTC** · 14 jours d'essai gratuit · *Le plus populaire*
- 3 comptes de vente
- Articles illimités
- Gestion des lots d'achat et coefficient objectif
- 300 annonces générées par IA / mois
- Statistiques avancées : rentabilité par marque, vitesse d'écoulement, projection
- Intégration Trello
- Assistant IA

**Négoce — 59 €/mois TTC** · 14 jours d'essai gratuit
- Comptes de vente illimités
- Annonces IA illimitées
- Modèles d'annonces personnalisables
- Rotation, stock dormant et marge par fournisseur
- Suivi des frais annexes et résultat net
- Support prioritaire

Sous la grille, une mention : *Un compte de vente supplémentaire sur n'importe quelle formule : +6 €/mois TTC.*

## Direction artistique

Charte « Direction C — Console tactile », à respecter. Elle est décrite en entier
dans `docs/design-system.md` ; ce qui suit en est le strict nécessaire pour une
page seule.

| Rôle | Couleur |
|---|---|
| Fond de page | `#E7ECE8` |
| Surface (blocs, cartes) | `#FFFFFF` |
| Filet / bordure | `#DDE4DF` |
| Encre principale | `#0E1412` |
| Encre secondaire | `#4C5B54` |
| Encre tertiaire | `#75857C` |
| Accent (boutons, liens, éléments actifs) | `#0F5132` |
| Encre sur accent | `#FFFFFF` |
| Positif | `#0F5132` |
| Négatif | `#B03A28` |

Polices : **Space Grotesk** pour absolument tout, des micro-libellés aux chiffres
héros — c'est la seule police d'interface du produit. **JetBrains Mono** pour ce
qui doit s'aligner ou se lire comme une donnée : prix, SKU, micro-libellés de
section en capitales espacées (`letter-spacing: 0.2em`, 10-11px).

Pas de mint, pas d'or : le produit n'a qu'une couleur d'accent. Si tu as besoin
d'une troisième teinte pour hiérarchiser, prends un niveau d'encre plus clair,
pas une nouvelle couleur.

Ambiance : sobre, dense, instrumentale. Un poste de pilotage, pas une brochure.
La profondeur vient des filets fins et de l'empilement de tons, **jamais des
ombres portées marquées**. Rayons généreux (20-26px sur les blocs, pilule sur les
boutons). Le vert d'accent s'emploie avec assurance mais reste minoritaire à
l'écran.

**À éviter absolument** : les dégradés violet-bleu, les fonds crème avec serif et accent terracotta, les emoji comme puces de section, tout centrer, les cartes arrondies avec une barre d'accent à gauche. Ce sont des tics de page générée. Fais des choix propres à ce produit.

Les chiffres de réassurance dans le hero doivent être présentés comme illustratifs, pas comme des statistiques clients réelles.

---

Génère maintenant le fichier HTML complet.
