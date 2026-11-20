# Duplicating, adapting, templates, versions and video

Read this when the request goes beyond a new piece.

## Duplicating and adapting

- **Duplicate** (same structure, new content): `npx opency new <slug> --from <piece>`. For another language, change `language` and record `translationOf`.
- **Adapt to another format:** `npx opency new <slug> --from <piece> --format 9:16`. It is linked with `adaptedFrom`. Then recompose: changing the format is not enough.
  - 4:5 → 9:16: bigger headline, content spread over the height, nothing in the top 250 px or the bottom 340.
  - 4:5 → 16:9: two columns.
- **Variant:** same content with another family of layouts, to compare.

## Templates

When a piece is approved with no changes, offer to save it: copy its `slide-NN.html` and `piece.json` to `brands/<brand>/templates/<name>/`, with a three-line `README.md` (what it is for, how many slides, what not to change). Use it with `npx opency new <slug> --template <name>`.

## Versions

- Before a big change: `npx opency version <piece> save "what I'm about to change"`.
- `list` shows the history, `diff` the texts that changed (including those edited by hand) and `restore N` goes back to a version without losing the current one.
- Small changes made in conversation do not need a copy: bumping `version` and adding the line to `history` is enough.

## Editable preview

`npx opency dev <piece>` opens the piece at `http://localhost:4321` and reloads on every change. The user can correct a text with a double click. Those edits are recorded in `history` with `by: "persona"` (the user) and are approved.

Only simple texts can be edited. A headline with a highlighted word (`<span class="hl">`) is changed through chat.

## Video

1. Add `data-motion` to each slide's `<main class="canvas">`: staggered entrance of the content and a slow push-in on the photo. The still image does not change.
2. One slide: `npx opency motion <piece> --slide 1 --duration 6`.
3. Several chained with a crossfade: `npx opency motion <piece> --slides all --duration 4` generates `render/reel.mp4`.
4. With music: `--audio file.mp3`. The user provides the audio, with the rights cleared. You do not download music.

For a custom animation, write `@keyframes` in the slide. Entrances of 0.3 to 1.2 s; nothing that blinks or bounces for no reason. Designed for 9:16.

There are no automatic subtitles and no voice-over: the slide's text is the message.
