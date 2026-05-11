# VIN Info.cz — Design System

Single source of truth for the brand. **Every visible color, font size, spacing value, and primitive on the site is defined here and in [`src/index.css`](../src/index.css).** When in doubt, read `index.css` — this document explains the *why*; the CSS is the *what*.

---

## 1. Palette

**Four brand colors + two surface neutrals. Nothing else.**

| Family | Token | Hex | Used for |
|---|---|---|---|
| **Brand Green** | `--brand-50` | `#eaf4eb` | Callout backgrounds, badges, hover wash |
| | `--brand-600` | `#2f7a3e` | Primary actions, links, focus ring, plate strip, icons in trust strip |
| | `--brand-700` | `#22612f` | Button hover/active, brand text on tinted backgrounds, callout body text |
| **Ink** | `--ink-300` | `#cbd5e1` | Borders, dividers, inactive step indicators |
| | `--ink-500` | `#64748b` | Muted text, helper copy, label text in `.dl-grid` |
| | `--ink-700` | `#334155` | Body text, info-alert accent stripe |
| | `--ink-900` | `#0f172a` | Headings, primary text, info-alert text |
| **Warn (Amber)** | `--warn-50` | `#fff8eb` | Warning-alert background |
| | `--warn-600` | `#b45309` | Warning-alert accent stripe and icon, reminder-row stripe (insurance) |
| | `--warn-700` | `#7a3a0a` | Warning-alert text |
| **Alert (Red)** | `--alert-50` | `#fef2f2` | Danger-alert background |
| | `--alert-600` | `#b91c1c` | Danger-alert accent stripe and icon, expired STK indicator, destructive actions |
| | `--alert-700` | `#8a1a1a` | Danger-alert text |
| **Surface** | `--surface` | `#ffffff` | Cards, modals, page background, button text on brand bg |
| | `--surface-soft` | `#f7f8fa` | Section breaks, info-alert background, grouped-section headers |

### Aliases (backwards compat)

- `--accent-amber` → `var(--warn-600)`
- `--accent-red` → `var(--alert-600)`

Prefer the scoped tokens in new code. Aliases exist only so existing usages keep resolving.

### Rule: no raw hex outside `:root`

Any new color reference must use a CSS variable. The only intentional exceptions:

1. `#fff` for button text on solid brand backgrounds (universal constant).
2. Static SVG files in `public/` (`logo.svg`, `favicon.svg`) — they're loaded as files outside React and must self-contain their colors.
3. Recharts `<Line stroke>` props — the library doesn't read CSS variables; the literal `#2f7a3e` is spelled-out `--brand-600`.

If you need a new shade, add a stop to `:root` (e.g., `--brand-100`) — don't drop a hex inline.

---

## 2. Typography

**Family:** Montserrat (variable font, weights 100–900) loaded from Google Fonts in `public/index.html`.

| Role | Class | Size / Line | Weight | Color |
|---|---|---|---|---|
| Display (hero) | `.display-tight` | `clamp(2rem, 4vw + 1rem, 2.75rem) / 1.15` | 700 | `--ink-900` |
| H1 / `.h1` | — | `2rem / 1.25` | 700 | `--ink-900` |
| H2 / `.h2` | — | `1.5rem / 1.33` | 700 | `--ink-900` |
| H3 / `.h3` | — | `1.25rem / 1.4` | 600 | `--ink-900` |
| Body | — | `1rem / 1.5` (Bootstrap base) | 400 | `--ink-700` |
| Lead | `.lead-tight` | `1.0625rem / 1.6`, max-width `60ch` | 400 | `--ink-700` |
| Small | — | `0.875rem` (Bootstrap) | 400 | `--ink-500` via `.text-muted-ink` |
| Tabular nums | `.num` | inherits | inherits | inherits |

### Decorations

- **`.eyebrow`** — uppercase, tracked, `0.75rem`, `--brand-600`. Sits above a section H2 to label the section. Use sparingly — one per section.
- **`.heading-accent`** — wraps a heading's text and underlines it with a 2px `--brand-600` thread (`box-shadow: inset 0 -2px 0`). The brand signature on section H2s. Apply to: every main section H2 across pages.
- **`.lead-tight`** — controlled lead paragraph, `max-width: 60ch`. Use directly under a hero H1 and never elsewhere.

---

## 3. Primitives

Reusable wrappers in `src/index.css`. Reach for these before writing one-off styles.

| Class | Shape | Use |
|---|---|---|
| `.section` | Vertical rhythm wrapper, `padding-block: var(--space-7)` | Top-level content section on a page |
| `.section-tight` | Same, but `var(--space-6)` | A subsection inside a larger `.section` |
| `.surface-soft` | Background `--surface-soft` | Apply to a `.section` to break visual rhythm without changing structure |
| `.card-soft` | White, 1px `--ink-300` border, `--radius-md`, `--shadow-sm`, `var(--space-5)` padding | Default card for grouping content |
| `.brand-callout` | `--brand-50` background, brand-tinted border, `--brand-700` text | Promotional or feature-highlight blocks |
| `.plate-title` | Inline plate-shape echoing the logo (white bg, ink-500 border, 12px `--brand-600` left strip) | Vehicle titles in client zone |
| `.icon-badge` | 48×48 round chip, white bg, brand-tinted border, `--brand-600` icon | Featured icons in benefit grids |
| `.icon-badge--solid` | Same but solid `--brand-600` bg + white icon | High-emphasis variant |
| `.heading-accent` | Wraps heading text, applies the brand underline thread | Section H2s |
| `.eyebrow` | Inline uppercase label | Above section H2s |
| `.lead-tight` | Constrained lead paragraph | Hero supporting copy |
| `.num` | `font-variant-numeric: tabular-nums` | VIN, mileage, dates — anything where columns of digits should align |
| `.dl-grid` | Two-column `dl` with responsive collapse | Vehicle info grouped sections |
| `.reminder-row` + `.reminder-{type}` | Left-accent stripe colored by reminder type | Reminder list rows in client zone |

### Utilities

- `.text-muted-ink` — `color: var(--ink-500) !important` (replaces Bootstrap `.text-muted`).
- `.text-brand` — `color: var(--brand-600) !important` (for SVG icons).
- `.text-amber` — `color: var(--warn-600) !important`.

---

## 4. Alerts (infoboxes)

**Rule: color = role.** Each Bootstrap `.alert-*` variant is wired to one palette family, no exceptions.

| Variant | Background | Border-left | Text | Icon | Means |
|---|---|---|---|---|---|
| `.alert-info` | `--surface-soft` | `--ink-700` | `--ink-900` | info-circle in `--ink-700` | Guidance, instructions, "how to" |
| `.alert-success` | `--brand-50` | `--brand-600` | `--brand-700` | check-circle in `--brand-600` | Confirmations, "saved" |
| `.alert-warning` | `--warn-50` | `--warn-600` | `--warn-700` | alert-triangle in `--warn-600` | Caution, "verify your email" |
| `.alert-danger` | `--alert-50` | `--alert-600` | `--alert-700` | x-circle in `--alert-600` | Errors, "not found", "failed" |
| `.alert-primary` / `.alert-secondary` | `--surface-soft` | `--ink-500` | `--ink-900` | info-circle in `--ink-500` | Fallback — prefer one of the four above |

**Note:** info uses ink/gray, not blue. The brand has no blue.

Icons are delivered via CSS `mask-image` data-URIs on `.alert-*::before`. **Zero JSX changes** — adding `<div className="alert alert-warning">…</div>` anywhere on the site picks up the full styling automatically.

---

## 5. Buttons

| Class | Background | Border | Text | Hover | Use |
|---|---|---|---|---|---|
| `.btn-primary` | `--brand-600` | `--brand-600` | `--surface` (white) | `--brand-700` bg | Primary CTA, default for forms |
| `.btn-brand` | `--brand-600` | `--brand-600` | `--surface` | `--brand-700` | Pill-shaped CTA (nav, hero) |
| `.btn-brand-outline` | transparent | `--brand-600` | `--brand-600` | `--brand-50` bg, `--brand-700` text | Secondary CTA |
| `.btn-outline-primary` | transparent | `--brand-600` | `--brand-600` | `--brand-50` bg, `--brand-700` text | Bootstrap-compatible outline |

### Specificity gotcha — already handled

`.brand-callout a:not(.btn)` is scoped so it doesn't paint button anchors. Inside `.brand-callout`, primary buttons keep `--surface` text. If you add a new container class with link styling, scope it the same way: `:not(.btn)`.

---

## 6. Logo & favicon

**Component:** [`src/components/BrandMark.tsx`](../src/components/BrandMark.tsx).

Inline SVG using `currentColor` for the strip and border, white for the plate body, with `VI` lettering. The parent component controls fill via `color` prop or CSS `color`.

```tsx
<BrandMark width={36} height={22} color="var(--brand-600)" />
```

**Sizing:**
- Navbar: `36×22`
- Footer: `44×28`
- Future modal headers: `28×18`

**Favicon:** `public/favicon.svg` — same shape, solid-fill variant tuned for 16×16 rendering. PNG fallbacks (`favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`) kept for older browsers.

**Don't** use raster logos. **Don't** introduce a second brand mark. **Don't** override the colors with anything outside the palette — the mark must always read as `--brand-600` on `--surface`.

---

## 7. Icons

**Component:** [`src/components/Icon.tsx`](../src/components/Icon.tsx).

Inline SVG, paths copied from [Lucide](https://lucide.dev) (MIT-licensed). Renders via `currentColor` and respects `size`, `className`, `style`, `strokeWidth`.

```tsx
<Icon name="check-circle" size={18} className="text-brand" />
<Icon name="shield-check" size={16} style={{ color: stkColor }} />
```

**Available names** (20 total):
`check`, `check-circle`, `x`, `x-circle`, `info`, `alert-triangle`, `alert-circle`, `shield`, `shield-check`, `bell`, `mail`, `car`, `calendar`, `chart`, `file-text`, `lock`, `search`, `chevron-right`, `external-link`, `plus`

### When to add a new icon

Edit `Icon.tsx`, add the name to the `IconName` union, and add the path to `PATHS`. Use Lucide paths to stay consistent. **Don't** install `lucide-react` — the inline approach keeps the bundle small and TypeScript-checked.

### Icons vs emoji

The brand uses **SVG icons for chrome** (UI structure: trust strip, alert leadings, section headers, summary lines). **Emoji are acceptable inline in body copy** when they're part of user-facing content (e.g., the reminder-type list on `/upozorneni-na-terminy` for non-decorative type labels). The line: if an emoji is decorative chrome, swap it for an `<Icon>`.

---

## 8. Vehicle info category icons

Defined in [`src/components/VehicleInfo.tsx`](../src/components/VehicleInfo.tsx) as `CATEGORY_ICONS`. Map from `VehicleFieldCategoryId` → `IconName`. Update this map (not the component JSX) when adding a new category.

---

## 9. Spacing, radius, shadows

```css
--space-1: 4px;    --space-2: 8px;     --space-3: 12px;
--space-4: 16px;   --space-5: 24px;    --space-6: 32px;
--space-7: 48px;   --space-8: 64px;    --space-9: 96px;

--radius-sm: 6px;  --radius-md: 10px;  --radius-lg: 16px;

--shadow-sm: subtle elevation (cards)
--shadow-md: stronger elevation (modals, dropdowns)
```

Use the tokens, not raw pixel values. If you need a new step, add it to `:root`.

---

## 10. Out of scope

- **Dark mode** — tokens are designed to support it but it isn't wired up. To add it: define a `prefers-color-scheme: dark` block in `:root` overriding the same tokens with dark-mode values. Don't introduce a separate file or token system.
- **Theming per page** — the palette is global. If a page needs a different feel, achieve it through composition of existing primitives (e.g., wrap in `.surface-soft`), not by swapping colors.
- **Third-party brand colors** — the 29 car-brand SVGs in `public/logos/` are third-party marks and stay as-is. They render via `<img>` inside vehicle info cards; do not restyle them.

---

## 11. Where things live

| Concern | File |
|---|---|
| Palette tokens, primitives, Bootstrap overrides, alerts | [`src/index.css`](../src/index.css) |
| Logo / brand mark | [`src/components/BrandMark.tsx`](../src/components/BrandMark.tsx) |
| Icons | [`src/components/Icon.tsx`](../src/components/Icon.tsx) |
| Favicon | [`public/favicon.svg`](../public/favicon.svg) |
| Static logo (for img references) | [`public/logo.svg`](../public/logo.svg) |
| Font import | [`public/index.html`](../public/index.html) (Google Fonts `<link>`) |
| Vehicle category → icon map | [`src/components/VehicleInfo.tsx`](../src/components/VehicleInfo.tsx) `CATEGORY_ICONS` |

---

## 12. Checklist for a new component

Before shipping a new UI component, verify:

- [ ] Uses only palette tokens — `rg "#[0-9a-fA-F]{3,6}" path/to/new/file` returns nothing (or only `#fff` for button text).
- [ ] Reuses a primitive (`.card-soft`, `.brand-callout`, `.icon-badge`) instead of bespoke CSS where one would fit.
- [ ] Headings use the matching scale class + `.heading-accent` for section H2s.
- [ ] Buttons use `.btn-primary` / `.btn-brand` / `.btn-brand-outline` — not raw `style` props.
- [ ] Icons use `<Icon name="…">`, not emoji (in chrome) or external libraries.
- [ ] Alerts use `<div className="alert alert-{info|success|warning|danger}">…</div>` — no per-instance icon JSX.
- [ ] `npm run build` passes; CSS bundle doesn't bloat (target: ≤ 5 KB total `main.css`).
