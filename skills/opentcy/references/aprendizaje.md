# Aprendizaje

Leé esto antes de anotar algo en `decisions.md` o cuando la persona corrige una pieza.

El criterio de la marca se acumula acá. Reglas para que no se contamine:

- **Una corrección puntual no es una regla.** "Este titular, más corto" se aplica a esa pieza y se anota en `piece.feedback`.
- **Una corrección se vuelve regla** si la persona dice que es para siempre ("de ahora en más…", "nunca más…") o si la misma corrección aparece en 2 piezas distintas. En ese caso:
  1. anotala en `decisions.md` con fecha y las palabras de la persona;
  2. avisá en una línea que la guardaste como regla.
- **Lo que gusta es una referencia, no una regla.** "Me encanta este" se anota como pieza y versión de referencia, no como "siempre hacer X".
- **Descargar, publicar o cambiar de estado no es aprobación.** Solo cuenta lo que la persona dice.
- **Ediciones manuales.** Lo que la persona cambió a mano está aprobado: no lo tocás salvo que el pedido lo nombre. Las ediciones hechas en la vista previa quedan en `piece.history` con `by: "persona"`; las hechas directo en el HTML se ven con `npx opentcy version <pieza> diff`. Revisá las dos antes de editar una pieza existente.
- **Contradicciones.** Si una regla nueva contradice una vieja, reemplazás la vieja. No se acumulan.

## Resultados

`npx opentcy results` muestra qué piezas publicadas rindieron mejor (tasa de guardado, compartidos, interacción) y los promedios por intención, tipo de fondo y layout de portada.

- Los números los carga la persona con `npx opentcy results add <pieza> --reach … --saves …`. Nunca los estimás.
- Con menos de 5 piezas por grupo es una pista para el plan semanal, no una regla. No la anotes en `decisions.md`.
- Usalo al planificar: repetí la estructura de lo que funcionó con un tema nuevo.
