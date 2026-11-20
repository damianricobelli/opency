# Setting up a brand

Read this when `brand.json` does not exist or contains `{{…}}` placeholders, or when the user asks to change the brand.

Ask for the minimum and deduce the rest: website, Instagram, brand manual, logo, previous posts, Figma.

**Propose first, write afterwards.** Show as text the palette with its roles, the typefaces, the voice and 2–3 hard rules. Write `brand.json`, `brand-kit.md` and `tokens.css` only once the user says yes. Before changing a brand that is already set up, copy `tokens.css` and `brand.json` to `brands/<brand>/history/YYYY-MM-DD/` so the change can be undone.

**Steps**

1. `npx opentcy brand new <slug> --name "Name"` creates `brands/<slug>/` with neutral tokens.
2. If there is a website: `npx opentcy brand import <url> --brand <slug>`. It leaves the colors by surface, the inks, the typefaces, the logo and the texts in `import/report.json`. Look at `import/home.png` too.
3. Propose the 7 roles, the 3 families, the voice and the verified data. Wait for the yes.
4. Write the files. Fonts go in `assets/fonts/` (variable or per weight) and logos in `assets/logos/`, declared in `brand.json → logos`.
5. `npx opentcy brand check --brand <slug>`: it has to finish with no problems. It tells you which combinations work for text and what `--on-accent` should be.
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
