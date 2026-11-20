# Brief: preguntar antes de diseñar

Leé esto antes de cargar una marca, armar una campaña o hacer una pieza cuyo pedido no diga qué se quiere transmitir.

Una pieza linda que dice lo que nadie pidió se rehace entera. El brief es la parte barata del trabajo: cinco minutos de preguntas ahorran tres rondas de correcciones.

## Cuándo preguntar y cuándo no

| Pedido | Qué hacés |
|---|---|
| Marca nueva | Brief `brand`. Si hay web, leela primero (`npx opentcy brand import <url>`) y preguntá solo lo que no encontraste. |
| Campaña (varias piezas, un lanzamiento, una fecha) | Brief `campaign` completo. No se diseña hasta tener las obligatorias. |
| Pieza suelta con pedido claro ("carrusel sobre X para el jueves") | No preguntes: decidí y decí qué supusiste. |
| Pieza suelta ambigua ("hacé algo para Instagram") | Brief `piece`: una o dos preguntas, no más. |
| Ajuste a una pieza existente | Nunca. Hacé el cambio. |

`npx opentcy brief questions [brand|campaign|piece]` lista las preguntas, cuáles son obligatorias (●) y de dónde se puede deducir cada una.

## Cómo preguntar

1. **Primero deducí.** Antes de la primera pregunta leé el pedido, `brand.json`, `brand-kit.md`, `decisions.md` y, si existe, `import/report.json`. Lo que ya está respondido no se pregunta: se confirma en una línea ("Asumo que le hablamos a dueños de PyMEs, como siempre").
2. **De a tandas cortas.** De 2 a 4 preguntas por turno. Nunca el formulario entero de una.
3. **Usá la herramienta de preguntas que tengas.** Con el MCP de opentcy, `brief_interview` le muestra un formulario a la persona si el cliente lo soporta. En Claude Code, `AskUserQuestion`. Si no hay ninguna, preguntá en el chat con opciones concretas para elegir.
4. **En palabras de la persona.** "¿Qué querés que sienta alguien al verlo?", no "¿Cuál es el tono de comunicación deseado?".
5. **Ofrecé opciones, aceptá otra cosa.** Las opciones son para destrabar, no para encasillar.
6. **Si no sabe, proponé.** "No sé cuántas piezas" se responde con un plan concreto para que diga sí o no.
7. **Cortá cuando alcanza.** Con las obligatorias respondidas se puede diseñar. Las opcionales que falten se anotan como supuestos.

## La pregunta que más importa

**¿Qué querés transmitir?** Si alguien recuerda una sola cosa de la campaña, ¿cuál tiene que ser?

Esa respuesta es la tesis. Devolvésela en una frase antes de seguir ("Entonces: *ordenar tus datos te hace decidir a tiempo*. ¿Es eso?"). Si no la puede confirmar, no hay campaña todavía: hay un tema.

Cada pieza del plan prueba la tesis desde un ángulo distinto. Si un ángulo no la prueba, es otra campaña.

## De las respuestas a las decisiones

| Respuesta | Decide |
|---|---|
| `message` | `direction.thesis` de cada pieza. |
| `objective` | La intención dominante del plan (`references/planificacion.md`): conocer → opinar y enseñar; consultas → caso y vender; ventas → mostrar producto y vender; guardados → enseñar. |
| `audience` | Vocabulario, ejemplos y qué objeción se resuelve. |
| `offer` y `proof` | Qué se puede afirmar. Lo confirmado va a `piece.sources`; lo que falte, `[A CONFIRMAR]`. |
| `feeling` | Modo dominante (foto o tipografía), densidad, textura. Urgente → tipográfico, alto contraste, poco texto. Cálido → foto propia, más aire. Técnico → datos, grillas, mono. |
| `channels` | Formatos y adaptaciones: feed 4:5, stories 9:16, LinkedIn 4:5 + PDF. |
| `visuals` | Orden de imágenes (`references/assets.md`). "Solo tipografía" prohíbe el stock. |
| `cta` | El único CTA, en el cierre de las piezas que venden. |
| `dates` | Fechas del plan y del calendario. |

## Guardar la campaña

```bash
npx opentcy campaign new <slug> --name "Nombre" --set message="…" --set objective="…"
npx opentcy campaign brief <slug> --set cta="…"          # completar o corregir
npx opentcy campaign plan <slug> --file plan.json        # el plan aprobado
npx opentcy campaign status <slug>                       # qué falta y cómo va
npx opentcy new <pieza> --campaign <slug> --layouts …    # cada pieza queda vinculada
```

El brief queda en `brands/<marca>/campaigns/<slug>/brief.json` y, legible, en `brief.md`.

**El plan** es una lista de piezas, cada una con `slug`, `angle` (una frase), `intent`, `format`, `channel` y `date`. Mostralo en texto y esperá el sí antes de guardarlo. Reglas del plan:

- Abrí con la pieza que explica el porqué; cerrá con la que pide la acción.
- No más de una pieza que vende cada tres.
- Cada canal recibe una pieza pensada para ese canal o una adaptación recompuesta, nunca el mismo archivo estirado.
- Cruzá las fechas con `calendar.md` y con `npx opentcy feed`.

## Durante la campaña

- Antes de cada pieza: `npx opentcy campaign status <slug>`.
- Todas las piezas comparten material (textura, tratamiento de foto) y un gesto distintivo que las hace reconocibles como serie.
- Si una respuesta del brief cambia a mitad de camino, actualizala con `campaign brief` y decile a la persona qué piezas ya hechas quedan afectadas.
