# Art direction

Read this before composing or when a piece looks generic.

## Formats and zones

| Format | Pixels | Use | Safe area | Critical strip (chrome only) |
|---|---|---|---|---|
| **4:5** (default) | 1080 × 1350 | Feed, carousels, LinkedIn | 80 px | Bottom 250 px: the immersive feed covers them |
| **1:1** | 1080 × 1080 | Square feed, X | 80 px | — |
| **9:16** | 1080 × 1920 | Stories, reels, TikTok | 250 top · 340 bottom · 80 sides | = safe area |
| **16:9** | 1920 × 1080 | Covers, YouTube, X | 96 · 120 sides | Bottom 150 px (player bar) |

- **Chrome** is the brand, the handle and the pager (`data-chrome`, `.chrome-bar`). It is the only thing that lives in the critical strip.
- **Content** goes inside `.content`, which already ends where the critical strip begins.
- **Bleed:** photos, backgrounds and decoration can extend past the canvas with `data-bleed`. Text and logo, never.

## Visual system

**Type scale by role** (`.t-*` classes in `base.css`, values in `tokens.css`):

| Role | Size at 1080 px |
|---|---|
| hero | 184 |
| cover | 100 |
| closer | 90 |
| title | 78 |
| subtitle | 52 |
| body | 40 |
| intro | 34 |
| cue | 32 |
| label | 28 |

- **Deviations:** only +6 to +14 px, and only on a short line that owns the slide.
- **Line height:** never below 1.0 on headlines with accented capitals.
- **Labels:** in `mono`, uppercase and tracked.

**Materials.** Use one per piece and hold it across every slide.
- **Texture** (`data-texture`):
  - `paper` for warm or editorial brands;
  - `fine` as the neutral;
  - `coarse` and `film` over dark backgrounds or photos;
  - `fabric` only if the brand is textile or craft.
- **`--grain`:** between 0.35 and 0.6 reads as material; above 0.8 it is noise.
- **Photos:** the same `data-grade` across the whole piece (`editorial`, `immersive`, `mono` or `duotone`).
- **Veils over photos:**
  - `high` or `low` when the text sits at the top or the bottom;
  - `flat` with a `--veil` of ~0.45;
  - `window` for the center;
  - `card` when the text sits in a card, with no veil.
- **Scrim** (`.scrim`) behind a specific block that does not pass contrast.
- **Glass:** at most one surface per slide.

**Color.**
- Tokens only. A literal color only if the user names it.
- The accent covers less than 10% of the slide. The accent as **small text** on a light background almost never passes contrast: use it for shapes, lines and dots.
- Surface rhythm within a carousel: alternate `on-bg`, `on-alt` and `on-primary` with intent, not at random.

**Anti-slop.** Never:
- a drawn button that cannot be tapped;
- stray dividers with nothing to divide;
- cards wrapping a single text for no reason;
- the same decorative chrome repeated on every slide;
- the identical template on every slide;
- triads of adjectives;
- invented quotes or "pseudo-quotes";
- bleed corners visible by accident;
- an element that does not guide the eye, group or give rhythm.

**Chips.** Only on the cover, and only with a data point that does not appear anywhere else ("Real case", "New", "Issue 12").

## What `base.css` gives you

- **Surfaces:** `on-bg`, `on-alt`, `on-primary`, `on-secondary`. On the last two and on photos, the accent becomes `--accent-inverse` if the brand defines it.
- **Highlight:** `.hl` for **one** word or concept of the headline in the accent color; `.accent-text` for a label. Only if that combination passes contrast (`npx opency brand check`).
- **Structure:** `.content` for the content and `.chrome-bar` (with `data-chrome`) for logo and pager. In 1:1 and 9:16, `.content` already leaves room for the bar.
- **Text budget:** `data-max="N"` on an element declares how many characters it supports. Do not raise it to make a long text fit.
- **Motion:** `data-motion` on the `<main class="canvas">` (see `references/operations.md`).
- **Brands with no texture or with square corners:** handle it in `tokens.css` (`--radius: 0`, no `data-texture`), not slide by slide.

## Layouts

14 archetypes in `templates/layouts/` (`npx opency layouts` shows them): typographic and photo covers, statement, number, steps, comparison, photo with card, data bars, testimonial, closer, news cards, product window, logo grid and co-brand. They are starting points: each brand takes them into its own system (see how `brands/urbs/pieces/` turned out).
