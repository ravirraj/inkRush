# Design System: Retro-Futurism

## 1. Definição do Estilo

- **Nome:** Retro-Futurism
- **Tipo:** Nostalgic, Neon, Futuristic, Retro
- **Keywords:** Vintage sci-fi, 80s aesthetic, neon glow, geometric patterns, CRT scanlines, pixel art, cyberpunk, synthwave
- **Era:** 1980s Retro
- **Light/Dark:** ✓ Full / ✓ Dark focused

## 2. Paleta de Cores

- **Primárias:** Neon Blue #0080FF, Hot Pink #FF006E, Cyan #00FFFF, Deep Black #1A1A2E, Purple #5D34D0
- **Secundárias:** Metallic Silver #C0C0C0, Gold #FFD700, duotone, 80s Pink #FF10F0, neon accents

## 3. Efeitos Visuais

CRT scanlines (::before overlay), neon glow (text-shadow+box-shadow), glitch effects (skew/offset keyframes)

## 4. AI Prompt Keywords

Build a retro-futuristic (cyberpunk/vaporwave) interface with neon colors (blue, pink, cyan), deep black background, 80s aesthetic, CRT scanlines, glitch effects, neon glow text/borders, monospace fonts, geometric patterns. Use neon text-shadow and animated glitch effects.

## 5. CSS Technical

```css
color: neon colors (#0080FF, #FF006E, #00FFFF), text-shadow: 0 0 10px neon, background: #000 or #1A1A2E, font-family: monospace, animation: glitch (skew+offset), filter: hue-rotate
```

## 6. Design System Variables

```css
--neon-colors: #0080FF #FF006E #00FFFF, --background: #000000, --font-family: monospace, --effect: glitch+glow, --scanline-opacity: 0.3, --crt-effect: true
```

## 7. Checklist de Implementação

- ☐ Neon colors used
- ☐ CRT scanlines effect
- ☐ Glitch animations active
- ☐ Monospace font
- ☐ Deep black background
- ☐ Glow effects applied
- ☐ 80s patterns present

## 8. Visual Theme & Atmosphere

Retro-Futurism — Design general com vintage sci-fi, 80s aesthetic, neon glow. Template e prompt pronto para IA. Estilo Retro-Futurism representa uma tendência moderna em design UI/UX web com foco em general.

- Density: 5/10 — Balanced
- Variance: 8/10 — Expressive
- Motion: 4/10 — Subtle

## 9. Color Palette & Roles

- **Neon Blue** (#0080FF) — Accent highlight, links and focus states
- **Hot Pink** (#FF006E) — Primary text color
- **Cyan** (#00FFFF) — Accent highlight, links and focus states
- **Deep Black** (#1A1A2E) — Dark surface, primary background
- **Purple** (#5D34D0) — Accent color, emphasis elements
- **Metallic Silver** (#C0C0C0) — Extended palette, decorative use
- **Gold** (#FFD700) — Premium accent, decorative highlights
- **80s Pink** (#FF10F0) — Primary text color

## 10. Typography Rules

- **Display / Hero:** monospace — Weight 700, tight tracking, used for headline impact
- **Body:** monospace — Weight 400, 16px/1.6 line-height, max 72ch per line
- **UI Labels / Captions:** monospace — 0.875rem, weight 500, slight letter-spacing
- **Monospace:** monospace — Used for code, metadata, and technical values

Scale:
- Hero: clamp(2.5rem, 5vw, 4rem)
- H1: 2.25rem
- H2: 1.5rem
- Body: 1rem / 1.6
- Small: 0.875rem

## 11. Component Stylings

- **Primary Button:** Subtly rounded (0.5rem) shape. Accent color fill. Hover: 8% darken + subtle lift shadow. Active: -1px translate tactile press. Font weight 600. No outer glows.
- **Secondary / Ghost Button:** Outline variant. 1.5px border in muted color. Text in primary color. Hover: subtle background fill.
- **Cards:** Subtly rounded (0.5rem) corners. Surface background. Subtle shadow (0 2px 12px rgba(0,0,0,0.06)). 1px border stroke.
- **Inputs:** Label above input. 1px border stroke. Focus ring: 2px accent color offset 2px. Error text below in semantic red. No floating labels.
- **Navigation:** Primary surface background. Active item: accent color indicator. Font weight 500 when active.
- **Skeletons:** Shimmer animation matching component dimensions. No circular spinners.
- **Empty States:** Icon-based composition with descriptive text and action button.

## 12. Layout Principles

- **Grid:** CSS Grid primary. Max-width containment: 1280px centered with 1.5rem side padding.
- **Spacing rhythm:** Balanced. Base unit: 0.5rem (8px).
- **Section vertical gaps:** clamp(4rem, 8vw, 8rem).
- **Hero layout:** Asymmetric composition.
- **Feature sections:** Asymmetric grid with varied card sizes. No 3-equal-columns.
- **Mobile collapse:** All multi-column layouts collapse below 768px. No horizontal overflow.
- **z-index contract:** base (0) / sticky-nav (100) / overlay (200) / modal (300) / toast (500).

## 13. Motion & Interaction

- **Physics:** Ease-out curves, 200-300ms duration. Smooth and predictable.
- **Entry animations:** Fade + translate-Y (16px → 0) over 420ms ease-out. Staggered cascades for lists: 80ms between items.
- **Hover states:** Subtle color shift + shadow adjustment over 200ms.
- **Page transitions:** Fade only (200ms).
- **Performance:** Only transform and opacity animated. No layout-triggering properties.

## 14. Anti-Patterns (Banned)

- No emojis in UI — use icon system only (Lucide, Heroicons)
- No pure white (#FFFFFF) backgrounds — use off-white or dark surfaces
- No oversaturated accent colors (saturation cap: 80%)
- No 3-column equal-width feature layouts — use zig-zag or asymmetric grid
- No `h-screen` — use `min-h-[100dvh]`
- No AI copywriting clichés: "Elevate", "Seamless", "Unleash", "Next-Gen"
- No broken external image links — use picsum.photos or inline SVG
- No generic lorem ipsum in demos

## Contexto Histórico

Estilo Retro-Futurism representa uma tendência moderna em design UI/UX web com foco em general.

## Caso de Uso

Landing pages, SaaS
