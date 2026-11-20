# Images and asset quality

Read this before using a photo or a logo, or searching for stock.

**Only use images registered in `brands/<brand>/assets/assets.json`**, referenced with `<img data-asset="id" src="../../assets/…">`. External URLs are not rendered.

**Order of preference:**
1. The brand's own photos.
2. House textures (`data-texture`: they need no file and no credit).
3. Stock libraries: `npx opency assets stock "<search in English>"` queries Openverse (no key needed) and, if the user connected their own account with `npx opency stock connect unsplash`, Unsplash too. Then `stock-import <ref>`. Credit and license are recorded automatically.
4. A URL the user gave you: `npx opency assets add <url>`.

**Searching a stock library well:**
- In English and specific: subject, action, framing and light (`"barista pouring latte art close up natural light"`), not a lone noun.
- With `--orientation portrait` for 4:5 and 9:16.
- Look at the previews before choosing (`stock_search` returns them). Discard anything that looks like a stock photo: smiles at the camera, handshakes, generic offices.
- Choose by the coverage column: `1080` or `2K` in the piece's format. Anything less goes in `photo-card`, not full bleed.
- If the license is **CC BY** (Openverse), attribution is mandatory: copy the `credit` from `assets.json` to the end of the caption.
- Two searches with nothing good: ask for one of the brand's own photos or solve it with typography. A mediocre photo makes the piece worse.

Import only the chosen photo, not the whole search. If the user asks for photos, that overrides the preference for typography.

**Quality on import.** The script fixes orientation, converts to sRGB, strips metadata (including GPS), keeps the full resolution and reports:
- **coverage:** whether it is enough for a full 4:5 background at 1080 or at 2K;
- **brightness:** `clara` (light), `media` (medium) or `oscura` (dark); it decides `ink` or `ink-inverse` and the veil;
- **dominant palette.**

If a photo is not big enough for a full background, it goes in a smaller block (`photo-card`), never enlarged: the render flags it as `image_upscaled`. If a logo arrives as a small bitmap, ask for the SVG.

**Logos.** They do not go in the photo registry: they are declared in `brand.json → logos` (`onLight`, `onDark`, `onPrimary`, `icon`). `npx opency new` puts the variant that matches each slide's surface on that slide, and the render flags `logo_low_contrast` if the logo cannot be told apart from its background.

**Mandatory analysis before using a photo.**
1. Look at it.
2. Record the focal point and the protected regions, in 0-to-1 coordinates on the original image:
   ```
   npx opency assets analyze <id> --focal 0.52,0.38 --protect "face:0.44,0.2,0.14,0.18" --protect "hand:…" --done
   ```
   Types: `face`, `hand`, `subject`, `text` and `logo`. An empty list with `--done` means "I looked at it and there is nothing to protect".
3. Use the focal point as `style="--fx:52%;--fy:38%"` on the `<img>`.

With that in place, the render warns you if the crop cuts a face (error) or if text covers it.

**Repetition.**
- A cover photo is never repeated.
- No photo comes back within 21 days (`npx opency feed` enforces it).
- A photo the user rejected is vetoed (`npx opency assets veto <id>`) and never shows up again.

**Few resources:**
- With no photo, the composition is typographic, with materials.
- With a single photo, it goes on the cover and the rest is typographic.
- With a cutout or a logo, give it room to breathe.

**Inspirations.** They inform structure and rhythm. They never go into a piece, and you never copy their colors, typefaces, logos, photos or text.
