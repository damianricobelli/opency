# Duplicar, adaptar, plantillas, versiones y video

Leé esto cuando el pedido va más allá de una pieza nueva.

## Duplicar y adaptar

- **Duplicar** (misma estructura, contenido nuevo): `npx opentcy new <slug> --from <pieza>`. Para otro idioma, cambiá `language` y anotá `translationOf`.
- **Adaptar a otro formato:** `npx opentcy new <slug> --from <pieza> --format 9:16`. Queda vinculada con `adaptedFrom`. Después recomponé: no alcanza con cambiar el formato.
  - 4:5 → 9:16: titular más grande, contenido repartido en el alto, nada en los 250 px de arriba ni en los 340 de abajo.
  - 4:5 → 16:9: dos columnas.
- **Variante:** mismo contenido con otra familia de layouts, para comparar.

## Plantillas

Cuando una pieza se aprueba sin cambios, ofrecé guardarla: copiá sus `slide-NN.html` y `piece.json` a `brands/<marca>/templates/<nombre>/`, con un `README.md` de tres líneas (para qué sirve, cuántos slides, qué no cambiar). Se usa con `npx opentcy new <slug> --template <nombre>`.

## Versiones

- Antes de un cambio grande: `npx opentcy version <pieza> save "qué voy a cambiar"`.
- `list` muestra el historial, `diff` los textos que cambiaron (también los editados a mano) y `restore N` vuelve a una versión sin perder la actual.
- Los cambios chicos por conversación no necesitan copia: alcanza con subir `version` y anotar la línea en `history`.

## Vista previa editable

`npx opentcy dev <pieza>` abre la pieza en `http://localhost:4321` y se recarga sola con cada cambio. La persona puede corregir un texto con doble clic. Esas ediciones quedan en `history` con `by: "persona"` y están aprobadas.

Solo se editan textos simples. Un titular con una palabra destacada (`<span class="hl">`) se cambia por chat.

## Video

1. Agregá `data-motion` al `<main class="canvas">` de cada slide: entrada escalonada del contenido y acercamiento lento de la foto. La imagen fija no cambia.
2. Un slide: `npx opentcy motion <pieza> --slide 1 --duration 6`.
3. Varios encadenados con fundido: `npx opentcy motion <pieza> --slides all --duration 4` genera `render/reel.mp4`.
4. Con música: `--audio archivo.mp3`. El audio lo aporta la persona, con los derechos resueltos. No descargás música.

Para una animación propia, escribí `@keyframes` en el slide. Entradas de 0,3 a 1,2 s; nada que parpadee o rebote sin motivo. Pensado para 9:16.

No hay subtítulos automáticos ni locución: el texto del slide es el mensaje.
