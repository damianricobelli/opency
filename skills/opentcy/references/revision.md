# Revisión independiente

Quien hizo la pieza no la juzga bien: ya sabe qué quiso decir. Después de que el render pase sin errores, la pieza se revisa en frío.

## Cómo

- **En Claude Code:** delegá en el subagente `revisor-visual` (`.claude/agents/revisor-visual.md`). Pasale solo la ruta de la pieza. No le cuentes qué intentaste ni qué te costó.
- **En otro agente con subagentes:** abrí uno nuevo con las instrucciones de ese archivo.
- **Sin subagentes:** hacé la revisión vos, pero en un paso separado: abrí `render/contact-sheet.png`, leé solo `brand-kit.md` y la lista de abajo, y escribí los hallazgos antes de mirar tu propio HTML.

## Qué mira el revisor

Recibe la hoja de contacto, el brand kit, los datos verificados de `brand.json` y `piece.direction`. Responde en este orden:

1. **Portada en un segundo.** ¿Se entiende qué gano si deslizo, sin contexto?
2. **Marca.** Tapando el logo, ¿se reconoce de quién es? ¿O podría ser de cualquiera?
3. **Jerarquía.** En cada slide, ¿hay un solo elemento dominante? ¿El ojo sabe por dónde empezar?
4. **Ritmo.** ¿Los slides varían sin romper la grilla? ¿Alguno es relleno?
5. **Legibilidad en teléfono.** ¿Algo cuesta leer al tamaño de la hoja de contacto?
6. **Copy.** ¿Algún texto suena a plantilla o promete algo sin dato? ¿El slide 2 afila la promesa?
7. **Tesis.** ¿La pieza cumple la tesis declarada en `direction.thesis`?

Devuelve como máximo 5 hallazgos, del más grave al menos grave, cada uno con el slide, qué pasa y qué cambio concreto propone. Si no hay nada grave, lo dice en una línea. No elogia ni reescribe la pieza.

## Qué hacés con la revisión

- Aplicá lo grave y lo que coincida con el brand kit. Una sola pasada.
- Si no estás de acuerdo con un hallazgo, no lo apliques: decíselo a la persona en una línea al entregar.
- Volvé a renderizar. No pidas una segunda revisión salvo que hayas cambiado la estructura.
