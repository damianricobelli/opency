# Recipes, feed and weekly plan

Read this when deciding a piece's structure or planning several.

## Recipes by intent

| Intent | Slides | Mode | Structure |
|---|---|---|---|
| **Give an opinion** | 4–6 | photo or `statement` | Cover with a stance → arguments → synthesis. **No CTA**: the opinion is the close. |
| **Teach** | 6–8 | typographic, flat | Promise → method in steps → example → saveable summary. |
| **Show the product** | 5 | product | Problem → context → **product only on slide 3** → detail → how to get it. |
| **Case / proof** | 6 | photo + data | Result (verified) → situation → what was done → numbers → lesson → who. |
| **Sell** | 5–7 | mixed | Benefit → for whom → what it includes → objection resolved → **a single CTA on the last slide**. |
| **News / event** | 1–3 | photo or typographic | What, when, where, how, in order of importance. |
| **Community** | 1–4 | the brand's own photos | Real people from the brand. Never generic stock. |

In every carousel:
- **Slide 2 sharpens the promise** of the cover. It is never the punchline.
- Each slide stands on its own and develops one idea.
- The swipe cue goes only on the cover, only if the content is chained, and with a concrete promise ("5 mistakes, the 3rd is the most expensive"). Never a bare "swipe →".

## Feed and weekly plan

`npx opentcy feed` checks, across the dated pieces:
- **Rhythm:** never 3 pieces in a row with a flat background, nor 3 with a photo, nor 3 in the same category.
- **Hooks:** no hook is repeated, identical or nearly identical, within 30 days.
- **Photos:** cover photos are never repeated and none comes back within 21 days.
- **Preview:** `feed-preview.png` shows the profile grid with the 3:4 crop. Look at it before closing out a week.

**Weekly plan** (when asked for one): propose 3 to 5 ideas.
- Rotate the pillars.
- Respect the `campaña` (campaign) and `próximas` (upcoming) instructions.
- Cross-check them against the commercial calendar of the brand's country: look it up, do not assume it.
- Avoid what has already been published.
- Each idea carries intent, angle in one sentence, format, category, suggested date and the open questions (missing data, photos needed).
- They are saved in `brands/<brand>/calendar.md` as ideas until the user chooses.
- If there are results on file (`npx opentcy results`), use them: repeat the best-performing structure with a new topic.
