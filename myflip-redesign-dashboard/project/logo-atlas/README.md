# MyFlip — Logo ATLAS · Pack d'export

Monogramme **M** monoline. Icône sur tuile `#1B4332` (vert forêt), trait `#A8D5B5` (mint).

## Fichiers

| Fichier | Format | Usage |
|---|---|---|
| `myflip-icon.svg` | SVG 96×96 | Icône seule, fond `#1B4332`. Vectoriel, redimensionnable à l'infini. |
| `myflip-sidebar.svg` | SVG 196×48 | Icône + wordmark « MyFlip » côte à côte, **fond transparent**. Pour la sidebar. |
| `myflip-favicon-32.png` | PNG 32×32 | Favicon navigateur. |
| `myflip-icon-180.png` | PNG 180×180 | Icône mobile / `apple-touch-icon` (PWA). |

## Couleurs

- Tuile / fond : `#1B4332`
- Monogramme M : `#A8D5B5`
- Wordmark (sidebar) : `#16261D`
- Variante sur fond sombre : passer le M en `#7FE3AC` si besoin de plus de contraste.

## Intégration

```html
<!-- favicon + PWA -->
<link rel="icon" type="image/png" sizes="32x32" href="/logo-atlas/myflip-favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="/logo-atlas/myflip-icon-180.png">

<!-- sidebar -->
<img src="/logo-atlas/myflip-sidebar.svg" height="32" alt="MyFlip">
```

## Notes

- Le wordmark du SVG sidebar est **vectorisé** (glyphes Space Grotesk 700 convertis en `<path>`) : aucune dépendance de police, rendu identique partout (`<img>`, outils de design, hors-ligne).
- Construction du M : `path d="M27 69 V31 L48 54 L69 31 V69"` sur un viewBox `0 0 96 96`, `stroke-width="8.5"`, extrémités et jointures arrondies.
