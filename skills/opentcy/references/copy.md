# Copy and captions

Read this before writing a piece's copy and its captions.

## Slide copy

- **One angle per piece.** If there are two ideas, they are two pieces.
- **Headline and subhead.** The headline states the fact. The subhead (support line) adds what is missing and **never** repeats the headline in other words.
- **Cover:** 8 words or fewer, specific, and it passes the screenshot test.
- **Start from the user's own sentence** when there is one. Copy the length, vocabulary and punctuation of `voice-samples.md`.
- **Figures with a source, or none.** The render flags as an error any figure with %, ×, $, "veces" (times), "clientes" (customers), etc. that is not in `brand.json → verified` or in `piece.sources`. It is validated figure by figure: a source backs only the numbers it names. If you need a data point, ask for it or use `<span class="tbd">[TO CONFIRM]</span>`: it blocks delivery on purpose.
- **Form of address:** the one in the brand kit (`vos`, `tú` or `usted`: the informal Rioplatense, informal and formal Spanish "you"), never mixed.
- **No em dashes, emoji or Markdown**, unless the brand uses them.
- **The brand name:** at most once per slide, outside the chrome.

**Banned families** (the linter detects them; avoid the whole family, not just the examples). The linter's phrase lists target Spanish-language copy, so the examples below are kept in Spanish; the same principles apply to copy in any language.

| Family | Examples | Fix |
|---|---|---|
| Manufactured contrast | "no es X, es Y", "no se trata de…", "más que un…", "no solo… sino…" ("it's not X, it's Y", "it's not about…", "more than a…", "not only… but…") | Say directly what it is, with a fact. |
| Stock closer | "así de simple", "no te lo pierdas", "¿qué esperás?", "te esperamos" ("it's that simple", "don't miss it", "what are you waiting for?", "we look forward to seeing you") | A concrete CTA or nothing. |
| Brochure verb | "potenciá", "transformá", "revolucioná", "llevá X al siguiente nivel", "descubrí el poder" ("boost", "transform", "revolutionize", "take X to the next level", "discover the power") | The verb for what actually happens ("ahorrás 2 horas", "entrenás 3 veces": "you save 2 hours", "you train 3 times"). |
| Empty adjective | "increíble", "único", "imperdible", "innovador", "de primer nivel" ("incredible", "unique", "unmissable", "innovative", "top-tier") | Replace it with the data point that proves it. |
| Worn-out opener | "¿Sabías que…?", "Imaginá…", "En el mundo de hoy…", "Hoy más que nunca…" ("Did you know…?", "Imagine…", "In today's world…", "Now more than ever…") | Start with the fact. |
| Parallel triad | "simple, rápido y efectivo" ("simple, fast and effective") | Pick one and prove it. |

The fix is always a concrete fact in the brand's words. If the brand uses one of these phrases in its real texts, it is allowed.

## Captions by network

| Network | Limit | Rules |
|---|---|---|
| **Instagram** | 2200 characters (recommended ≤ 150 words) | Strong first line (it is the only thing visible before "more"), never repeating the cover. It adds something the piece does not say. Max. 3 specific hashtags. One CTA that names its object, or none. |
| **LinkedIn** | 3000 | Its own text, not the IG caption. First line = hook. Plain text, no emoji or hashtag chains. Close with a question or a concrete request. **Carousel = PDF** (`--pdf`): each page has to stand on its own. |
| **X** | 280 per tweet, thread ≤ 25 | `captions.x.thread`. Images in 1:1 or 16:9 (adaptation). |
| **TikTok** | 4000 | 9:16 format. |

**Alt text** per slide in `slides[].alt`: describe what is seen and what it says, in one or two sentences. Instagram and LinkedIn accept it, and the render requires it.
