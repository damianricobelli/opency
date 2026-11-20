# Recetas, feed y plan semanal

Leé esto al decidir la estructura de una pieza o al planificar varias.

## Recetas por intención

| Intención | Slides | Modo | Estructura |
|---|---|---|---|
| **Opinar** | 4–6 | foto o `statement` | Portada con postura → argumentos → síntesis. **Sin CTA**: la opinión es el cierre. |
| **Enseñar** | 6–8 | tipográfico, plano | Promesa → método en pasos → ejemplo → resumen guardable. |
| **Mostrar producto** | 5 | producto | Problema → contexto → **producto recién en el slide 3** → detalle → cómo conseguirlo. |
| **Caso / prueba** | 6 | foto + datos | Resultado (verificado) → situación → qué se hizo → números → lección → quién. |
| **Vender** | 5–7 | mixto | Beneficio → para quién → qué incluye → objeción resuelta → **un solo CTA en el último slide**. |
| **Novedad / evento** | 1–3 | foto o tipográfico | Qué, cuándo, dónde, cómo, en orden de importancia. |
| **Comunidad** | 1–4 | foto propia | Personas reales de la marca. Nunca stock genérico. |

En todo carrusel:
- El **slide 2 afila la promesa** de la portada. Nunca es el remate.
- Cada slide se sostiene solo y desarrolla una idea.
- La indicación de deslizar va solo en la portada, solo si el contenido está encadenado, y con una promesa concreta ("5 errores, el 3 es el más caro"). Nunca "deslizá →" a secas.

## Feed y plan semanal

`npx opentcy feed` controla, sobre las piezas con fecha:
- **Ritmo:** nunca 3 piezas seguidas con fondo plano, ni 3 con foto, ni 3 de la misma categoría.
- **Ganchos:** no se repite uno igual o casi igual dentro de 30 días.
- **Fotos:** las de portada no se repiten nunca y ninguna vuelve antes de 21 días.
- **Vista previa:** `feed-preview.png` muestra la grilla del perfil con el recorte 3:4. Miralo antes de cerrar una semana.

**Plan semanal** (cuando te lo pidan): proponé 3 a 5 ideas.
- Rotá los pilares.
- Respetá las instrucciones de campaña y próximas.
- Cruzalas con el calendario comercial del país de la marca: buscalo, no lo supongas.
- Evitá lo ya publicado.
- Cada idea lleva intención, ángulo en una frase, formato, categoría, fecha sugerida y las preguntas abiertas (datos que faltan, fotos que hacen falta).
- Se guardan en `brands/<marca>/calendar.md` como ideas hasta que la persona elija.
- Si hay resultados cargados (`npx opentcy results`), usalos: repetí la estructura que mejor rindió con un tema nuevo.
