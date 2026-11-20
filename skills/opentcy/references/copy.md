# Copy y captions

Leé esto antes de escribir el copy de una pieza y sus captions.

## Copy de los slides

- **Un ángulo por pieza.** Si hay dos ideas, son dos piezas.
- **Titular y bajada.** El titular afirma el hecho. La bajada agrega lo que falta y **nunca** repite el titular con otras palabras.
- **Portada:** 8 palabras o menos, específica, que pase el test del screenshot.
- **Partí de la frase de la persona** cuando la haya. Copiá el largo, el vocabulario y la puntuación de `voice-samples.md`.
- **Cifras con fuente o nada.** El render marca como error toda cifra con %, ×, $, "veces", "clientes", etc. que no figure en `brand.json → verified` o en `piece.sources`. Se valida cifra por cifra: una fuente respalda solo los números que nombra. Si hace falta un dato, pedilo o usá `<span class="tbd">[A CONFIRMAR]</span>`: bloquea la entrega a propósito.
- **Trato:** el del brand kit (vos, tú o usted), sin mezclar.
- **Sin guiones largos, emoji ni Markdown**, salvo que la marca los use.
- **El nombre de la marca:** como máximo una vez por slide, fuera del chrome.

**Familias prohibidas** (el linter las detecta; evitá la familia entera, no solo los ejemplos):

| Familia | Ejemplos | Arreglo |
|---|---|---|
| Contraste armado | "no es X, es Y", "no se trata de…", "más que un…", "no solo… sino…" | Decí directamente qué es, con un hecho. |
| Cierre de stock | "así de simple", "no te lo pierdas", "¿qué esperás?", "te esperamos" | CTA concreto o nada. |
| Verbo de folleto | "potenciá", "transformá", "revolucioná", "llevá X al siguiente nivel", "descubrí el poder" | El verbo de lo que realmente pasa ("ahorrás 2 horas", "entrenás 3 veces"). |
| Adjetivo vacío | "increíble", "único", "imperdible", "innovador", "de primer nivel" | Reemplazar por el dato que lo prueba. |
| Apertura gastada | "¿Sabías que…?", "Imaginá…", "En el mundo de hoy…", "Hoy más que nunca…" | Empezar por el hecho. |
| Tríada paralela | "simple, rápido y efectivo" | Elegir uno y probarlo. |

El arreglo siempre es un hecho concreto en palabras de la marca. Si la marca usa una de estas frases en sus textos reales, vale.

## Captions por red

| Red | Límite | Reglas |
|---|---|---|
| **Instagram** | 2200 caracteres (recomendado ≤ 150 palabras) | Primera línea fuerte (es lo único visible antes de "más"), nunca repite la portada. Aporta algo que la pieza no dice. Máx. 3 hashtags específicos. Un CTA que nombra su objeto, o ninguno. |
| **LinkedIn** | 3000 | Texto propio, no la caption de IG. Primera línea = gancho. Texto plano, sin emoji ni cadenas de hashtags. Cierra con una pregunta o un pedido concreto. **Carrusel = PDF** (`--pdf`): cada página tiene que sostenerse sola. |
| **X** | 280 por tweet, hilo ≤ 25 | `captions.x.thread`. Imágenes en 1:1 o 16:9 (adaptación). |
| **TikTok** | 4000 | Formato 9:16. |

**Alt text** por slide en `slides[].alt`: describe qué se ve y qué dice, en una o dos oraciones. Instagram y LinkedIn lo aceptan, y el render lo exige.
