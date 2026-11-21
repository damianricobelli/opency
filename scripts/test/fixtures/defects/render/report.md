# Quality report — defects

4:5 · 1 slide(s) · ×1 · 7 errors · 11 warnings

## Slide 1 (flat)
- warning `outside_safe_area` #out — text outside the safe area
- warning `illegible_text_size` #tiny — 14 px on canvas = 5.1 pt on a phone (min. 10.5)
- **ERROR** `headline_orphan` #headline — last line has a single word: "sola"
- **ERROR** `critical_overlap` #a — overlaps #b
- **ERROR** `external_image` img — external image: download it into assets/ and register it (npx @opency/cli assets add)
- **ERROR** `missing_asset` img — failed to load https://example.com/foto.jpg
- **ERROR** `placeholder_left`  — {{…}} placeholders left unfilled
- warning `decorative_container` div.card — an empty box: every visible object needs a job. Remove it or give it content
- warning `orphan_divider` span.rule — a rule with nothing next to it to separate or announce: remove it
- warning `over_budget` #headline — 43 characters; this layout is designed for ~20. Shorten the text or switch layouts (do not shrink the type)
- **ERROR** `request_failed`  — failed to load https://example.com/foto.jpg
- warning `unreadable_contrast` #low — contrast 4.18:1 (min. 4.5:1)
- warning `brand_literal_color`  — colors outside tokens: #777777

## Copy and captions
- warning `copy_emoji` slide 1 #claim — emoji: the brand does not use them
- **ERROR** `unsourced_figure` slide 1 #claim — "40%": unsourced figure. It must appear in brand.json (verified) or in piece.sources with that figure
- warning `copy_too_many_hashtags` caption instagram — 4 hashtags (max. 3)
- warning `copy_filler_hashtags` caption instagram — filler hashtags: #love #fyp #viral #marketing
- warning `missing_alt_text` slides 1 — missing alt text (accessibility; Instagram and LinkedIn support it)
