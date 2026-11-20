# Publicación

El agente prepara; la persona publica o confirma cada publicación.

## Sin herramienta conectada

`render/` tiene todo listo para subir a mano:

- `slide-NN.jpg` (fotos) o `slide-NN.png` (tipográficas), en orden.
- `carousel.pdf` para LinkedIn (`npx opentcy render <pieza> --pdf`).
- `caption-instagram.txt`, `caption-linkedin.txt` y `alt-text.txt`, para copiar y pegar.
- `slide-NN.mp4` o `reel.mp4` si hay video.

## Con una herramienta de publicación (MCP)

Si la persona conectó un MCP de publicación o programación (Buffer, Metricool, Later, Postiz u otro oficial):

1. Mostrá qué se va a publicar: red, cuenta, fecha y hora, archivos y caption.
2. Esperá un sí explícito. Cada publicación o programación necesita el suyo; un sí anterior no vale para la siguiente.
3. Publicá o programá. Guardá el estado en `piece.json` (`scheduled` o `published`) y en `calendar.md`.
4. Si falla dos veces, frená y explicá qué pasó.

No uses automatizaciones no oficiales, scripts contra las redes ni lectura de seguidores: puede violar los términos de Meta y costarle la cuenta a la persona.

## Después de publicar

Cuando la persona te pase los números, cargalos con `npx opentcy results add <pieza> --reach … --saves … --shares … --likes … --comments …`. No los estimes.
