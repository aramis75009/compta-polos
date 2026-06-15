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
