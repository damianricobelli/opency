# Setting up a brand

## The first-run setup: four chapters, one at a time

Use this with a new user or a brand that is not finished. `onboarding_status` (`npx @opency/cli start`) says which chapter is open, what is missing and the exact next step. Every answer is saved as it arrives, so the setup can stop anywhere and resume.

| # | Chapter | What you ask | Tool |
|---|---|---|---|
| 1 | **The brand** | Its name. Optional: what it does, its website, how often they want to post. | `onboarding_start` creates it |
| 2 | **Identity** | Where it comes from: the website, a preset, or colors and typefaces they give you. | `brand_identity` builds it and returns the **brand board** |
| 3 | **The goal** | Main objective (a choice), who they want to reach (with the suggestions for that objective), and optionally what to tell or sell first. | `onboarding_start` saves it |
| 4 | **The first piece** | Which of three ideas they want. Then only the facts that idea needs. | `piece_ideas`, then `piece_design` |

How to run it well:

- **Two or three questions per turn, never the whole brief.** Offer the choices as choices (use your question tool if you have one; clients with forms get them from `onboarding_start`). Anything the user already said is not asked again: pass it in.
- **Show something within the first minute.** If there is a website, call `brand_identity` with `source="website"` right after the name: the user sees their palette, typefaces and three sample slides before answering anything else. With no website, describe the two or three presets (`brand_presets`) that fit what the brand does and let them choose.
- **The board is the confirmation.** Show it and ask one question: does this look like the brand? To change one thing, call `brand_identity` again with `source="manual"` and only that color or typeface. `brand_board` re-renders it at any time.
- **Read the notes that come with the identity.** They say where each color came from, what the contrast repair changed and which typefaces could not be installed (commercial families arrive as `.woff2` files). Tell the user in one line what you assumed.
- **Goal before piece.** The objective decides which three ideas `piece_ideas` returns. Offer them in one line each. For the one the user picks, ask only for what its `needs` lists, and never invent those facts.
- **Close with a rendered piece.** The setup is complete when the first piece renders. Then offer the next step: another version (`piece_variant`), the next piece, or a weekly plan.
- **Depth comes later.** Voice rules, pillars, verified facts and references belong to the long brand brief (`brief_interview` with `kind="brand"`). Run it when the first piece exists and the user wants pieces that sound more like them, not before.

The rest of this guide is the reference for what a complete brand has on file.

Read this when `brand.json` does not exist or contains `{{…}}` placeholders, or when the user asks to change the brand.

Ask for the minimum and deduce the rest: website, Instagram, brand manual, logo, previous posts, Figma.

**Propose first, write afterwards.** Show as text the palette with its roles, the typefaces, the voice and 2–3 hard rules. Write `brand.json`, `brand-kit.md` and `tokens.css` only once the user says yes. Before changing a brand that is already set up, copy `tokens.css` and `brand.json` to `brands/<brand>/history/YYYY-MM-DD/` so the change can be undone.

**Steps**

1. `npx @opency/cli brand new <slug> --name "Name"` creates `brands/<slug>/` with neutral tokens.
2. If there is a website: `npx @opency/cli brand import <url> --brand <slug>`. It leaves the colors by surface, the inks, the typefaces, the logo and the texts in `import/report.json`. Look at `import/home.png` too.
3. Propose the 7 roles, the 3 families, the voice and the verified data. Wait for the yes.
4. Write the files. Fonts go in `assets/fonts/` (variable or per weight) and logos in `assets/logos/`, declared in `brand.json → logos`.
5. `npx @opency/cli brand check --brand <slug>`: it has to finish with no problems. It tells you which combinations work for text and what `--on-accent` should be.
6. Make a test piece and render it.

**Where each thing goes**

- `brand.json`: what the scripts read. Name, handle, language, country, form of address (`address`), whether it uses emoji or em dashes, pillars, logos, defaults (texture, photo treatment) and `verified` (data with source and date).
- `brand-kit.md`: what you read. Voice with hard rules, color roles explained, creative profile, standing instructions and the assumptions still to be confirmed.
- `tokens.css`: the actual values.
- `voice-samples.md`: real texts from the brand.

**What has to end up on file**

- **Identity:** name, what it does, for whom, the goal of its social channels, offer, language and country (for the commercial calendar).
- **Content pillars:** 3–5 recurring themes. The weekly plan rotates among them.
- **Voice:** hard rules instead of adjectives ("sentences under 12 words", "never exclamation marks", "addresses the reader as `vos`" — the informal Rioplatense Spanish "you"). The voice overrides your preferences on tone, length and punctuation.
- **Voice samples:** up to 5 real texts from the brand, up to 600 characters each, copied verbatim. Never invented or paraphrased.
- **7 color roles:** `primary`, `secondary`, `accent`, `bg`, `bg-alt`, `ink` and `ink-inverse`.
  - `ink` goes on `bg`.
  - `ink-inverse` goes on photos, on `primary` and on dark panels.
  - `accent` is used once per slide and covers less than 10% of the surface.
  - Verify AA contrast for every text-on-background combination before proposing it.
- **3 type families:** `display` (headlines), `body` (text) and `mono` (small uppercase labels).
  - Ask for the `.woff2` files and save them in `assets/fonts/`.
  - Declare only the weights that have a file. A synthetic weight or italic is not the original font, and you never present it as such.
- **Logo:** ask for it in SVG, with primary, logo mark and wordmark variants, and light and dark versions.
- **Standing instructions**, in three scopes:
  - `general`: always applies.
  - `campaña` (campaign): with an expiry date.
  - `próximas` (upcoming): launches and dates that are coming up.
  - They are saved only when the user explicitly asks to remember, change or delete a rule. A one-off wish for a piece is not an instruction.
- **Verified data** (`brand.json → verified`): prices, results, customers and testimonials with permission, each with source and date. Naming a customer requires their permission, even if they appear on the website.
- **Monochrome brands:** if the accent is the same color as `primary`, define `--accent-inverse` (the accent on dark panels) and `--on-accent`.
- **Assumptions:** everything you deduced without confirmation is listed at the end of `brand-kit.md`, and you tell the user.

Close the onboarding with a rendered test piece.

## Typefaces by name

Do not ask for `.woff2` files if the family is open-licensed: `npx @opency/cli fonts search "<name>"`, then `fonts add "<Family>" --role display|body|mono --apply` (MCP: `brand_fonts`). It downloads the files from Fontsource, writes the license next to them, adds the `@font-face` rules to `tokens.css` (keeping a backup) and never fabricates a weight the family does not have. For a commercial typeface, ask the user for the files; if they cannot provide them, propose the closest open family and record it as an assumption.

## The brand's brief is saved

What the user answers when the brand is loaded goes to `brands/<brand>/brief.json` and `brief.md` (`npx @opency/cli campaign brand-brief --set key="value"`; `brief_interview` with `kind="brand"` does it for you). Read it before asking anything again.
