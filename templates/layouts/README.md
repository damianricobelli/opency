# Layout library

Fourteen slide archetypes (4:5), tested against quality control: 0 errors and 0 warnings. They are starting points. Each piece adapts them: change the copy, the background, the texture and the size, without repeating the same layout on every slide.

`npx opentcy layouts` renders them to `templates/layouts/render/contact-sheet.png`. To build a piece by combining them:

```bash
npx opentcy new my-piece --layouts cover-type,statement,steps,big-number,closer
```

| # | Name | What for | Notes |
|---|---|---|---|
| 01 | `cover-type` | Typographic cover | No photo. One accent element that bleeds off the canvas. |
| 02 | `cover-photo` | Cover with a full-bleed photo | `high` veil + scrim behind the text. Photo with a focal point (`--fx/--fy`) and its analysis done. |
| 03 | `statement` | Opinion / statement | One sentence that owns the slide. `--primary` background. |
| 04 | `big-number` | Quantity | The number in `--ink`, not in the accent: the accent as text does not pass contrast on a light background. |
| 05 | `steps` | Sequence / method | Up to 5 steps. More than that, split into two slides. |
| 06 | `comparison` | Before/now, A versus B | Two blocks: the "now" one is boxed in the accent. Max. 3 points per column, 2–4 words each. |
| 07 | `photo-card` | Photo + explanation | The card overlaps the edge of the photo to tie the two blocks together. |
| 08 | `data-bars` | Comparing quantities | Real data with a visible source. Highlighted bar in the accent, the rest in `--ink`. |
| 09 | `testimonial` | Social proof | **Only with a real testimonial, verbatim and with permission.** Never invented or paraphrased. |
| 10 | `closer` | Close + CTA | A single CTA that names its object (what, where, how). |
| 11 | `news-cards` | Roundup of several news items | Four cards; the first one featured. Each item in a line or two. |
| 12 | `app-window` | Showing a digital product | A drawn window with rows. No invented numbers: real names and statuses. |
| 13 | `logo-grid` | Customers, partners, tools | **Only with each brand's permission.** Each cell holds an `<img class="logo">`. |
| 14 | `cobrand` | Announcement with another brand | Photo with a veil and the two logos joined by a cross. |

The copy in the layouts is sample copy. Each layout declares its text budget with `data-max`: the render warns you if you exceed it by more than 20%.

The data in 08 and the quote in 09 are fictional: always replace them.
