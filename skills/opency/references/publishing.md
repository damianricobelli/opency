# Publishing

The agent prepares; the user publishes or confirms each publication.

## With no tool connected

`render/` has everything ready to upload by hand:

- `slide-NN.jpg` (photos) or `slide-NN.png` (typographic), in order.
- `carousel.pdf` for LinkedIn (`npx opency render <piece> --pdf`).
- `caption-instagram.txt`, `caption-linkedin.txt` and `alt-text.txt`, to copy and paste.
- `slide-NN.mp4` or `reel.mp4` if there is video.

## With a publishing tool (MCP)

If the user connected a publishing or scheduling MCP (Buffer, Metricool, Later, Postiz or another official one):

1. Show what is going to be published: network, account, date and time, files and caption.
2. Wait for an explicit yes. Each publication or scheduling needs its own; an earlier yes does not count for the next one.
3. Publish or schedule. Save the status in `piece.json` (`scheduled` or `published`) and in `calendar.md`.
4. If it fails twice, stop and explain what happened.

Do not use unofficial automations, scripts against the networks or follower scraping: it can violate Meta's terms and cost the user their account.

## After publishing

When the user gives you the numbers, enter them with `npx opency results add <piece> --reach … --saves … --shares … --likes … --comments …`. Do not estimate them.
