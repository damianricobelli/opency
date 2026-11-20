# Independent review

Whoever made the piece cannot judge it well: they already know what they meant to say. After the render passes with no errors, the piece is reviewed cold.

## How

- **In Claude Code:** delegate to the `visual-reviewer` subagent (`.claude/agents/visual-reviewer.md`). Pass it only the piece's path. Do not tell it what you tried or what was hard.
- **In another agent with subagents:** open a new one with the instructions from that file.
- **Without subagents:** do the review yourself, but as a separate step: open `render/contact-sheet.png`, read only `brand-kit.md` and the list below, and write down the findings before looking at your own HTML.

## What the reviewer looks at

It receives the contact sheet, the brand kit, the verified data from `brand.json` and `piece.direction`. It answers in this order:

1. **Cover in one second.** Is it clear what I gain by swiping, with no context?
2. **Brand.** With the logo covered, can you tell whose it is? Or could it be anyone's?
3. **Hierarchy.** On each slide, is there a single dominant element? Does the eye know where to start?
4. **Rhythm.** Do the slides vary without breaking the grid? Is any of them filler?
5. **Legibility on a phone.** Is anything hard to read at contact-sheet size?
6. **Copy.** Does any text sound like a template or promise something without data? Does slide 2 sharpen the promise?
7. **Thesis.** Does the piece deliver on the thesis declared in `direction.thesis`?

It returns at most 5 findings, from most to least serious, each with the slide, what is wrong and the concrete change it proposes. If there is nothing serious, it says so in one line. It does not praise or rewrite the piece.

## What you do with the review

- Apply what is serious and what agrees with the brand kit. A single pass.
- If you disagree with a finding, do not apply it: tell the user in one line when you deliver.
- Render again. Do not ask for a second review unless you changed the structure.
