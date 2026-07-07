# Plan — MyFlip sur iPhone (PWA + mobile parfait)

État du repo (audit 2026-06-29) : Next.js 14.2.35 / React 18. App déjà mobile-first.
Manque : la couche PWA (rien) + 2 pages avec tables non converties en cartes.

Méthode : copier-coller chaque prompt ci-dessous dans **Claude Code** (VS Code), un par un, valider le diff avant de passer au suivant.

---

## PHASE 1 — Rendre l'app installable (PWA)

But : "Ajouter à l'écran d'accueil" sur iPhone → vraie app plein écran, icône MyFlip, pas de barre Safari.

### Prompt 1.1 — Manifest + icônes + meta Apple

```
Objectif : rendre MyFlip installable comme PWA sur iPhone (add to home screen, plein écran, icône).

1. Crée app/manifest.ts (Next 14 metadata route) qui exporte un MetadataRoute.Manifest :
   - name: "MyFlip", short_name: "MyFlip"
   - description: "Pilotage de revente de vêtements de marque."
   - start_url: "/dashboard"
   - display: "standalone"
   - background_color: "#EEF1EC"
   - theme_color: "#1B4332"
   - lang: "fr"
   - icons : 192x192 et 512x512 (type image/png), plus une entrée 512x512 purpose:"maskable".

2. Génère les icônes PNG 192 et 512 à partir de public/logo-atlas/myflip-icon.svg
   (icône sur fond #1B4332). Mets-les dans public/logo-atlas/ :
   myflip-icon-192.png et myflip-icon-512.png. Pour la maskable, garde une marge
   de sécurité (~10% de padding) pour ne pas que l'icône soit rognée.

3. Dans app/layout.tsx, complète l'export viewport et metadata SANS casser l'existant :
   - viewport : ajoute themeColor: "#1B4332" (déjà : width device-width, initialScale 1, viewportFit cover).
   - metadata : ajoute appleWebApp: { capable: true, statusBarStyle: "default", title: "MyFlip" }.

Respecte CLAUDE.md. Ne touche pas à la logique auth ni aux autres pages.
Montre-moi le diff avant d'écrire.
```

### Prompt 1.2 (optionnel) — Mode offline / cache

```
Ajoute un service worker minimal pour que MyFlip s'ouvre même sans réseau
(au moins le shell de l'app + page de fallback). Utilise @ducanh2912/next-pwa
(compatible Next 14 App Router) ou serwist. Configure dans next.config, n'active
le SW qu'en production, et ajoute le dossier généré dans .gitignore.
Explique-moi les implications avant de modifier package.json.
```
> Optionnel. À faire seulement si tu veux le offline ; sinon Phase 1.1 suffit pour installer l'app.

---

## PHASE 2 — Mobile parfait (corriger les 2 tables)

Modèle de référence déjà dans le repo : `app/a-comptabiliser/page.tsx`
(cartes `md:hidden` + table `hidden md:block`).

### Prompt 2.1 — Stock

```
Dans app/stock/page.tsx, la liste articles est un <table> en overflow-x-auto
(~ligne 1078) : sur mobile ça scrolle horizontalement. Applique la règle CLAUDE.md
"Tables → jamais sur mobile".

- Garde le <table> mais enveloppe-le en "hidden md:block".
- Ajoute une version "md:hidden" en cartes (une carte par article) reprenant les
  mêmes données et actions que les lignes du tableau.
- Inspire-toi du pattern déjà utilisé dans app/a-comptabiliser/page.tsx.
- Touch targets min 44px sur les boutons/actions des cartes (h-11 / min-h-[44px]).
- Préserve la virtualisation et les filtres existants.

Teste mentalement à 390px. Montre-moi le diff avant d'écrire.
```

### Prompt 2.2 — Statistiques

```
Dans app/statistiques/page.tsx il y a 2 tables (min-w-[600px], ~lignes 204 et 244)
en overflow-x-auto → scroll horizontal sur mobile.

Pour chacune : garde la table en "hidden md:block" et ajoute une version "md:hidden"
en cartes (modèle : app/a-comptabiliser/page.tsx). Touch targets 44px.
Montre-moi le diff avant d'écrire.
```

### Prompt 2.3 — Vérif finale mobile (toutes pages)

```
Passe en revue chaque page de app/ à 390px (iPhone 14) selon les règles mobile de
CLAUDE.md : pas de débordement horizontal, touch targets >= 44px, titres
text-3xl md:text-4xl, padding px-4 (md:px-6), empilement flex-col md:flex-row,
aucune <table> visible en dessous de md. Liste les écarts restants AVANT de corriger,
puis attends ma validation.
```

---

## Test après chaque phase
- `npm run dev`, ouvrir sur iPhone (même réseau Wi-Fi, http://<ip-du-mac>:3000) OU
  DevTools Chrome mode responsive iPhone 14.
- PWA : sur déploiement HTTPS (Vercel), Safari iOS → Partager → "Sur l'écran d'accueil".
  (L'install PWA iOS ne marche qu'en HTTPS, donc tester l'install sur l'URL Vercel,
  pas en localhost.)
```
```
