# Librería de layouts

Catorce arquetipos de slide (4:5), probados con el control de calidad: 0 errores y 0 advertencias. Son puntos de partida. Cada pieza los adapta: cambia el copy, el fondo, la textura y el tamaño, sin repetir el mismo layout en todos los slides.

`npx opentcy layouts` los renderiza en `templates/layouts/render/contact-sheet.png`. Para armar una pieza combinándolos:

```bash
npx opentcy new mi-pieza --layouts cover-type,statement,steps,big-number,closer
```

| # | Nombre | Para qué | Notas |
|---|---|---|---|
| 01 | `cover-type` | Portada tipográfica | Sin foto. Un elemento de acento que sangra fuera del canvas. |
| 02 | `cover-photo` | Portada con foto a sangre | Velo `high` + scrim detrás del texto. Foto con foco (`--fx/--fy`) y análisis hecho. |
| 03 | `statement` | Opinión / afirmación | Una frase dueña del slide. Fondo `--primary`. |
| 04 | `big-number` | Cantidad | El número en `--ink`, no en acento: el acento como texto no pasa contraste sobre fondo claro. |
| 05 | `steps` | Secuencia / método | Hasta 5 pasos. Más que eso, dividir en dos slides. |
| 06 | `comparison` | Antes/ahora, A contra B | Dos bloques: el de "ahora" va recuadrado en acento. Máx. 3 puntos por columna, de 2–4 palabras. |
| 07 | `photo-card` | Foto + explicación | La tarjeta pisa el borde de la foto para unir los dos bloques. |
| 08 | `data-bars` | Comparar cantidades | Datos reales con fuente visible. Barra destacada en acento, el resto en `--ink`. |
| 09 | `testimonial` | Prueba social | **Solo con un testimonio real, textual y con permiso.** Nunca inventado ni parafraseado. |
| 10 | `closer` | Cierre + CTA | Un solo CTA que nombra su objeto (qué, dónde, cómo). |
| 11 | `news-cards` | Resumen de varias novedades | Cuatro tarjetas; la primera destacada. Cada novedad en una línea o dos. |
| 12 | `app-window` | Mostrar un producto digital | Ventana dibujada con filas. Sin números inventados: nombres y estados reales. |
| 13 | `logo-grid` | Clientes, aliados, herramientas | **Solo con permiso de cada marca.** Cada casilla lleva un `<img class="logo">`. |
| 14 | `cobrand` | Anuncio con otra marca | Foto con velo y los dos logos unidos por una cruz. |

El copy de los layouts es de muestra. Cada layout declara su presupuesto de texto con `data-max`: el render avisa si lo excedés en más de 20 %.

Los datos del 08 y la cita del 09 son ficticios: se reemplazan siempre.
