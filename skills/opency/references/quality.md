# Quality control and delivery

Read this when the render flags something you do not know how to fix, and before delivering.

## Report codes

`npx @opency/cli render` measures on the actual render. Open `render/report.md`.

| Code | What it means | What to do |
|---|---|---|
| `unreadable_contrast` | Contrast measured pixel by pixel, even over photos and gradients, on the worst 10% of the background. Minimum 4.5:1 (large text 3:1). | Switch to `ink`/`ink-inverse`, add a veil or scrim, move the block or change the photo's focal point. |
| `headline_orphan` | The headline's last line has a single word. | Rewrite or adjust the width (`max-width` in `ch`). Never a forced `<br>` if the text may change. |
| `critical_overlap` | Two text blocks overlap. | Rearrange. |
| `layer_out_of_bounds` / `outside_safe_area` / `critical_zone` | Text outside the canvas, outside the safe area or in the strip the interface covers. | Use `.content` and `.chrome-bar`. |
| `text_overflow` | The text spills out of its box. | Shorten it or change layout. |
| `illegible_text_size` | Less than 10.5 pt on a 390 pt phone (9 pt for labels). | Move up a role in the scale. |
| `top_stack` / `dead_space` | Content piled up at the top, sunk to the bottom or too small for the slide. | Spread it out, enlarge the hierarchy or add an element that has a function. |
| `accent_mass` | The accent covers more than 10% of the slide. | Reduce the accent to small shapes. |
| `image_upscaled` | The photo is shown larger than its resolution. | A smaller block or another photo. |
| `subject_cropped` / `text_over_subject` | The crop cuts a protected region, or text covers it. | Adjust `--fx`/`--fy` or move the text. |
| `missing_asset` / `external_image` / `asset_unregistered` / `vetoed_asset` | A problem with the image. | Register, download or replace it. |
| `font_not_loaded` | It is rendering with a fallback font. | Put the `.woff2` in `assets/fonts/`. |
| `logo_low_contrast` | Part of the logo cannot be told apart from the background (for example, a violet logo mark on a violet panel). | Use the `brand.json → logos` variant for that surface. |
| `over_budget` | The text exceeds what the layout supports (`data-max`) by more than 20%. | Shorten it or change layout. Do not shrink the type. |
| `alignment_drift` / `material_drift` / `template_rhythm` | The bottom bar moves between slides, textures or treatments are mixed, or every slide uses the same layout. | Unify the bar and the material; vary the structure. |
| `brand_literal_color` | A color outside the tokens. | Change it to `var(--…)`. |
| `placeholder_left` / `data_tbd` | Placeholders or to-be-confirmed data remain. | Fill them in. It is not delivered like this. |
| `copy_*` / `caption_*` / `unsourced_figure` / `missing_alt_text` | Findings from the copy linter (see `references/copy.md`). | Rewrite. Figures carry a source. |

- **Errors:** nothing is delivered with errors.
- **Warnings:** resolve them or explain them in one line.
- **Limits of the measurement:** contrast is measured on the actual background, but text fit, overlap and empty space are estimates. Everything passing does not replace looking at the contact sheet.

## Export and delivery

**Which file to use:**
- **PNG:** for typographic and flat-color pieces.
- **JPG** (95, 4:4:4 chroma): for pieces with photos. Instagram recompresses a well-made JPG less.
- **`--scale 2`:** for 2K or print deliveries.
- **`--pdf`:** for LinkedIn carousels.
- **MP4:** for stories and reels.

**Default delivery message:**

```
**[Title]** · 4:5 · 6 slides · v1 · 0 errors
Angle: [one sentence]

[contact-sheet.png and/or the files]

IG caption:
[caption]

[if applicable: one line per accepted warning or decision the user might not expect]
Should I adjust anything, or mark it as approved?
```

No account of the process. If you chose something you were not asked for (photo instead of typography, a different length), say so in one line.

## Independent review

After the render passes, ask for a visual review from someone who did not see the process (`references/review.md`). The checks measure; they do not judge whether the piece is good.

## Tests

`npx @opency/cli doctor` verifies that the checks still detect what they should (a slide with deliberate defects) and that the layout library passes clean. Run the tests after touching any script or `base.css`.

## Safe fixes first

Before fixing anything by hand, run `npx @opency/cli repair <piece>` (MCP: `piece_repair`). It applies only fixes that cannot change meaning or design: a headline's line breaks, the logo variant for the slide's surface, mixed textures, pager numbering and the `lang` attribute. It saves a version first and lists everything it skipped with the reason. Copy, color, layout, type size and image choices are never touched automatically: those are yours.

The copy linter has phrase lists for Spanish and English, chosen by the piece's language (then the brand's).
