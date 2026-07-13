---
name: Forest Precision
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#404942'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#717972'
  outline-variant: '#c0c9c0'
  surface-tint: '#32694a'
  primary: '#003b22'
  on-primary: '#ffffff'
  primary-container: '#1a5336'
  on-primary-container: '#8cc5a0'
  inverse-primary: '#99d4ae'
  secondary: '#006c46'
  on-secondary: '#ffffff'
  secondary-container: '#79f7b8'
  on-secondary-container: '#007149'
  tertiary: '#2f3432'
  on-tertiary: '#ffffff'
  tertiary-container: '#464a49'
  on-tertiary-container: '#b6b9b8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#b5f0c9'
  primary-fixed-dim: '#99d4ae'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#175034'
  secondary-fixed: '#7cfabb'
  secondary-fixed-dim: '#5edda0'
  on-secondary-fixed: '#002112'
  on-secondary-fixed-variant: '#005234'
  tertiary-fixed: '#e0e3e1'
  tertiary-fixed-dim: '#c4c7c5'
  on-tertiary-fixed: '#181c1b'
  on-tertiary-fixed-variant: '#434846'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  title-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  stat-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-padding: 24px
  gutter: 16px
  card-gap: 20px
  sidebar-width: 260px
  section-margin: 32px
---

## Brand & Style
The design system is a "Corporate Modern" aesthetic with a sophisticated, organic twist. It balances productivity with a calm, premium atmosphere through the use of deep forest greens, soft off-white surfaces, and high-quality geometric typography. 

The visual DNA relies on high-contrast focal points (primary green cards) against a sea of low-contrast, structured elements. This creates a clear hierarchy where the most important metrics demand immediate attention while secondary data remains legible but receding. The overall mood is professional, reliable, and meticulously organized, suitable for high-level project management and SaaS analytics.

## Colors
The palette is built on a "monochromatic-plus" strategy using varying shades of green to signify depth and status.

- **Primary Forest (#1A5336):** Used for high-impact cards, primary buttons, and active states.
- **Accent Mint (#47C98E):** Used for positive trends, progress indicators, and secondary data visualizations.
- **Surface & Backgrounds:** The main app background is a crisp white, while the sidebar and inactive cards utilize a soft neutral off-white (#F9F9F9) to create subtle separation.
- **Borders:** Extremely thin, light grey (#EAEAEA) borders provide structure without visual clutter.

## Typography
This design system utilizes **Plus Jakarta Sans** across all levels to maintain a contemporary, geometric feel. 

Hierarchy is established through extreme weight contrast. Large statistical figures use a bold, heavy weight to act as visual anchors. Labels and secondary metadata use a lighter weight and decreased opacity (or grey hex codes) to ensure the interface doesn't feel overly dense. Mobile adjustments should prioritize reducing the `display-lg` and `stat-lg` sizes to fit within a 4-column portrait grid.

## Layout & Spacing
The layout follows a **Fixed Sidebar + Fluid Content** model. The sidebar is anchored to the left with a width of 260px, utilizing a vertical navigation list.

The main content area is organized into a modular grid:
- **Header:** Contains search, notifications, and user profile.
- **Top Row:** 4-column grid for KPI cards.
- **Middle/Bottom Rows:** Mix of 2-column and 3-column spans for complex widgets like "Project Analytics" and "Team Collaboration."
- **Internal Padding:** Cards utilize a consistent 20px - 24px internal padding to ensure content has significant "breathability."

## Elevation & Depth
Depth in this design system is achieved through **Tonal Layering** and **Soft Ambient Shadows** rather than heavy skeuomorphism.

- **Background:** Flat white base layer.
- **Sidebar:** Raised via a very subtle 1px border on the right; no shadow.
- **Cards:** Use a "Low-Contrast Outline" approach combined with an extremely soft, large-radius shadow (Blur: 20px, Opacity: 4%, Color: Black). This makes the cards appear to "hover" just above the surface.
- **Active State:** The primary green card uses its vibrant color to create "visual elevation" over the neutral-toned cards.

## Shapes
The shape language is consistently "Rounded" to soften the professional tone. 

- **Containers/Cards:** Use a standard 1.25rem (20px) radius.
- **Buttons:** Primary buttons are pill-shaped (full radius), while secondary buttons or search bars may use a slightly tighter 12px - 16px radius.
- **Progress Bars:** Utilize fully rounded caps (pill-shaped) for a modern, fluid appearance.

## Components

### KPI Cards
Standardized containers for metrics. They include a title, a large "Stat" figure, a directional trend indicator (pill-shaped badge), and a "View More" icon in the top right. The active card is inverted (white text on dark green background).

### Buttons & Inputs
- **Primary Button:** Dark forest green background, white text, pill-shaped.
- **Secondary Button:** White background, thin grey border, dark text.
- **Search Input:** Highly rounded, includes leading icon (Search) and trailing keyboard shortcut hint (e.g., ⌘F).

### Analytics Widgets
- **Bar Charts:** Use rounded caps on bars. Alternate between solid fills and diagonal hash-patterns (stripes) to represent different data states (e.g., projected vs. actual).
- **Donut Progress:** A thick-stroke semi-circle gauge using the primary forest green for "Completed" and a striped pattern for "Pending."

### Lists & Tables
Team lists use circular avatars with status indicators. Data rows are separated by whitespace and subtle borders rather than alternating row colors. Labels for status (e.g., "In Progress") are displayed in small, low-contrast pill badges.