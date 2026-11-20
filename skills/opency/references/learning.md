# Learning

Read this before writing anything to `decisions.md` or when the user corrects a piece.

The brand's judgment accumulates here. Rules to keep it from getting contaminated:

- **A one-off correction is not a rule.** "This headline, shorter" applies to that piece and goes in `piece.feedback`.
- **A correction becomes a rule** if the user says it is permanent ("from now on…", "never again…") or if the same correction shows up in 2 different pieces. In that case:
  1. write it to `decisions.md` with the date and the user's own words;
  2. say in one line that you saved it as a rule.
- **What the user likes is a reference, not a rule.** "I love this one" is recorded as a reference piece and version, not as "always do X".
- **Downloading, publishing or changing status is not approval.** Only what the user says counts.
- **Manual edits.** Anything the user changed by hand is approved: do not touch it unless the request names it. Edits made in the preview are recorded in `piece.history` with `by: "persona"` (the user; your own edits are `"agente"`, the agent); edits made directly in the HTML show up with `npx opency version <piece> diff`. Check both before editing an existing piece.
- **Contradictions.** If a new rule contradicts an old one, replace the old one. They do not pile up.

## Results

`npx opency results` shows which published pieces performed best (save rate, shares, engagement) and the averages by intent, background type and cover layout.

- The user enters the numbers with `npx opency results add <piece> --reach … --saves …`. Never estimate them.
- With fewer than 5 pieces per group it is a hint for the weekly plan, not a rule. Do not write it to `decisions.md`.
- Use it when planning: repeat the structure of what worked with a new topic.
