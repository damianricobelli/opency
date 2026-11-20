# Dirección de arte

Leé esto antes de componer o cuando una pieza se ve genérica.

## Formatos y zonas

| Formato | Píxeles | Uso | Zona segura | Franja crítica (solo chrome) |
|---|---|---|---|---|
| **4:5** (default) | 1080 × 1350 | Feed, carruseles, LinkedIn | 80 px | 250 px inferiores: el feed inmersivo los tapa |
| **1:1** | 1080 × 1080 | Feed cuadrado, X | 80 px | — |
| **9:16** | 1080 × 1920 | Stories, reels, TikTok | 250 arriba · 340 abajo · 80 lados | = zona segura |
| **16:9** | 1920 × 1080 | Portadas, YouTube, X | 96 · 120 lados | 150 px inferiores (barra del reproductor) |

- **Chrome** es la marca, el handle y el paginador (`data-chrome`, `.chrome-bar`). Es lo único que vive en la franja crítica.
- **Contenido** va dentro de `.content`, que ya termina donde empieza la franja crítica.
- **Sangrado:** fotos, fondos y decoración pueden salir del canvas con `data-bleed`. Texto y logo, nunca.

## Sistema visual

**Escala tipográfica por rol** (clases `.t-*` de `base.css`, valores en `tokens.css`):

| Rol | Tamaño a 1080 px |
|---|---|
| hero | 184 |
| cover | 100 |
| closer | 90 |
| title | 78 |
| subtitle | 52 |
| body | 40 |
| intro | 34 |
| cue | 32 |
| label | 28 |

- **Desvíos:** solo de +6 a +14 px, y solo en una línea corta que es dueña del slide.
- **Interlineado:** nunca menos de 1.0 en titulares con tildes en mayúscula.
- **Etiquetas:** en `mono`, mayúscula y con tracking.

**Materiales.** Usá uno por pieza y sostenelo en todos los slides.
- **Textura** (`data-texture`):
  - `paper` para marcas cálidas o editoriales;
  - `fine` como neutro;
  - `coarse` y `film` sobre fondos oscuros o fotos;
  - `fabric` solo si la marca es textil o artesanal.
- **`--grain`:** entre 0,35 y 0,6 se lee como material; arriba de 0,8 es ruido.
- **Fotos:** el mismo `data-grade` en toda la pieza (`editorial`, `immersive`, `mono` o `duotone`).
- **Velos sobre foto:**
  - `high` o `low` cuando el texto va arriba o abajo;
  - `flat` con `--veil` de ~0,45;
  - `window` para el centro;
  - `card` cuando el texto va en tarjeta, sin velo.
- **Scrim** (`.scrim`) detrás de un bloque puntual que no pasa contraste.
- **Glass:** como máximo una superficie por slide.

**Color.**
- Solo tokens. Un color literal solo si la persona lo nombra.
- El acento cubre menos del 10 % del slide. El acento como **texto chico** sobre fondo claro casi nunca pasa contraste: usalo en formas, líneas y puntos.
- Ritmo de superficies dentro de un carrusel: alterná `on-bg`, `on-alt` y `on-primary` con intención, no al azar.

**Anti-slop.** Nunca:
- un botón dibujado que no se puede tocar;
- divisores sueltos sin nada que dividir;
- tarjetas que envuelven un solo texto sin motivo;
- el mismo chrome decorativo repetido en todos los slides;
- la plantilla idéntica en cada slide;
- tríadas de adjetivos;
- citas inventadas o "pseudo-citas";
- esquinas de sangrado visibles por accidente;
- un elemento que no guía la mirada, agrupa o da ritmo.

**Chips.** Solo en la portada, y solo con un dato que no aparece en otro lado ("Caso real", "Nuevo", "Edición 12").

## Recursos de `base.css`

- **Superficies:** `on-bg`, `on-alt`, `on-primary`, `on-secondary`. Sobre las dos últimas y sobre fotos, el acento pasa a `--accent-inverse` si la marca lo define.
- **Destacar:** `.hl` para **una** palabra o concepto del titular en el color de acento; `.accent-text` para una etiqueta. Solo si esa combinación pasa contraste (`npx opentcy brand check`).
- **Estructura:** `.content` para el contenido y `.chrome-bar` (con `data-chrome`) para logo y paginador. En 1:1 y 9:16 `.content` ya deja lugar a la barra.
- **Presupuesto de texto:** `data-max="N"` en un elemento declara cuántos caracteres soporta. No lo subas para que entre un texto largo.
- **Movimiento:** `data-motion` en el `<main class="canvas">` (ver `references/operaciones.md`).
- **Marcas sin textura o de esquinas rectas:** se resuelve en `tokens.css` (`--radius: 0`, sin `data-texture`), no slide por slide.

## Layouts

14 arquetipos en `templates/layouts/` (`npx opentcy layouts` los muestra): portadas tipográfica y con foto, afirmación, número, pasos, comparación, foto con tarjeta, barras de datos, testimonio, cierre, tarjetas de novedades, ventana de producto, grilla de logos y co-marca. Son puntos de partida: cada marca los lleva a su sistema (ver cómo quedó `brands/urbs/pieces/`).
