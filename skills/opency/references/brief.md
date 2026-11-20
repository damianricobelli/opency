# Brief: ask before you design

Read this before setting up a brand, building a campaign or making a piece whose request does not say what it should convey.

A good-looking piece that says what nobody asked for gets redone from scratch. The brief is the cheap part of the job: five minutes of questions save three rounds of corrections.

## When to ask and when not to

| Request | What you do |
|---|---|
| New brand | `brand` brief. If there is a website, read it first (`npx opency brand import <url>`) and ask only what you did not find. |
| Campaign (several pieces, a launch, a date) | Full `campaign` brief. No design until the required answers are in. |
| Single piece with a clear request ("carousel about X for Thursday") | Do not ask: decide, and say what you assumed. |
| Ambiguous single piece ("make something for Instagram") | `piece` brief: one or two questions, no more. |
| Tweak to an existing piece | Never. Make the change. |

`npx opency brief questions [brand|campaign|piece]` lists the questions, which ones are required (●) and where each one can be deduced from.

## How to ask

1. **Deduce first.** Before the first question, read the request, `brand.json`, `brand-kit.md`, `decisions.md` and, if it exists, `import/report.json`. What is already answered is not asked: confirm it in one line ("I'm assuming we're talking to small-business owners, as usual").
2. **In short rounds.** 2 to 4 questions per turn. Never the whole form at once.
3. **Use whatever question tool you have.** With the opency MCP, `brief_interview` shows the user a form if the client supports it. In Claude Code, `AskUserQuestion`. If there is none, ask in the chat with concrete options to choose from.
4. **In the user's words.** "What do you want someone to feel when they see it?", not "What is the desired communication tone?".
5. **Offer options, accept something else.** The options are there to get things moving, not to box the user in.
6. **If the user doesn't know, propose.** "I don't know how many pieces" is answered with a concrete plan they can say yes or no to.
7. **Stop when you have enough.** With the required questions answered, you can design. Any optional ones still missing are recorded as assumptions.

## The question that matters most

**What do you want to get across?** If someone remembers just one thing from the campaign, what should it be?

That answer is the thesis. Play it back in one sentence before going on ("So: *organizing your data lets you decide in time*. Is that it?"). If the user cannot confirm it, there is no campaign yet: there is a topic.

Each piece in the plan proves the thesis from a different angle. If an angle does not prove it, it belongs to another campaign.

## From answers to decisions

| Answer | Decides |
|---|---|
| `message` | Each piece's `direction.thesis`. |
| `objective` | The plan's dominant intent (`references/planning.md`): awareness → give an opinion and teach; inquiries → case study and sell; sales → show the product and sell; saves → teach. |
| `audience` | Vocabulary, examples and which objection gets resolved. |
| `offer` and `proof` | What can be claimed. What is confirmed goes in `piece.sources`; what is missing, `[TO CONFIRM]`. |
| `feeling` | Dominant mode (photo or typography), density, texture. Urgent → typographic, high contrast, little text. Warm → the brand's own photos, more room to breathe. Technical → data, grids, mono. |
| `channels` | Formats and adaptations: feed 4:5, stories 9:16, LinkedIn 4:5 + PDF. |
| `visuals` | Order of image sources (`references/assets.md`). "Typography only" rules out stock. |
| `cta` | The single CTA, on the closing slide of the pieces that sell. |
| `dates` | Dates for the plan and the calendar. |

## Saving the campaign

```bash
npx opency campaign new <slug> --name "Name" --set message="…" --set objective="…"
npx opency campaign brief <slug> --set cta="…"          # fill in or correct
npx opency campaign plan <slug> --file plan.json        # the approved plan
npx opency campaign status <slug>                       # what is missing and how it is going
npx opency new <piece> --campaign <slug> --layouts …    # each piece gets linked
```

The brief is stored in `brands/<brand>/campaigns/<slug>/brief.json` and, in readable form, in `brief.md`.

**The plan** is a list of pieces, each with `slug`, `angle` (one sentence), `intent`, `format`, `channel` and `date`. Show it as text and wait for a yes before saving it. Rules for the plan:

- Open with the piece that explains the why; close with the one that asks for the action.
- No more than one selling piece in every three.
- Each channel gets a piece designed for that channel or a recomposed adaptation, never the same file stretched.
- Cross-check the dates against `calendar.md` and `npx opency feed`.

## During the campaign

- Before each piece: `npx opency campaign status <slug>`.
- All the pieces share a material (texture, photo treatment) and a distinctive gesture that makes them recognizable as a series.
- If a brief answer changes midway, update it with `campaign brief` and tell the user which finished pieces are affected.
