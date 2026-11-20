# Control de calidad y entrega

Leé esto cuando el render marca algo que no sabés resolver, y antes de entregar.

## Códigos del reporte

`npx opentcy render` mide sobre el render real. Abrí `render/report.md`.

| Código | Qué significa | Qué hacer |
|---|---|---|
| `unreadable_contrast` | Contraste medido píxel a píxel, incluso sobre fotos y degradados, en el 10 % más desfavorable del fondo. Mínimo 4,5:1 (texto grande 3:1). | Cambiar a `ink`/`ink-inverse`, agregar velo o scrim, mover el bloque o cambiar el foco de la foto. |
| `headline_orphan` | Última línea del titular con una sola palabra. | Reescribir o ajustar el ancho (`max-width` en `ch`). Nunca `<br>` forzado si el texto cambia. |
| `critical_overlap` | Dos bloques de texto se pisan. | Reordenar. |
| `layer_out_of_bounds` / `outside_safe_area` / `critical_zone` | Texto fuera del canvas, de la zona segura o en la franja que tapa la interfaz. | Usar `.content` y `.chrome-bar`. |
| `text_overflow` | El texto se sale de su caja. | Acortar o cambiar de layout. |
| `illegible_text_size` | Menos de 10,5 pt en un teléfono de 390 pt (9 pt en etiquetas). | Subir de rol en la escala. |
| `top_stack` / `dead_space` | Contenido amontonado arriba, hundido o chico para el slide. | Repartir, agrandar la jerarquía o sumar un elemento con función. |
| `accent_mass` | El acento cubre más del 10 % del slide. | Reducir el acento a formas chicas. |
| `image_upscaled` | La foto se muestra más grande que su resolución. | Bloque más chico u otra foto. |
| `subject_cropped` / `text_over_subject` | El recorte corta o el texto tapa una región protegida. | Ajustar `--fx`/`--fy` o mover el texto. |
| `missing_asset` / `external_image` / `asset_unregistered` / `vetoed_asset` | Problema con la imagen. | Registrar, descargar o reemplazar. |
| `font_not_loaded` | Se ve con una fuente de reemplazo. | Poner el `.woff2` en `assets/fonts/`. |
| `logo_low_contrast` | Parte del logo no se distingue del fondo (por ejemplo, isotipo violeta sobre panel violeta). | Usar la variante de `brand.json → logos` para esa superficie. |
| `over_budget` | El texto excede en más de 20 % lo que el layout soporta (`data-max`). | Acortar o cambiar de layout. No achicar la letra. |
| `alignment_drift` / `material_drift` / `template_rhythm` | La barra inferior se mueve entre slides, hay texturas o tratamientos mezclados, o todos los slides usan el mismo layout. | Unificar la barra y el material; variar la estructura. |
| `brand_literal_color` | Color fuera de los tokens. | Pasar a `var(--…)`. |
| `placeholder_left` / `data_tbd` | Quedan marcadores o datos a confirmar. | Completarlos. No se entrega así. |
| `copy_*` / `caption_*` / `unsourced_figure` / `missing_alt_text` | Hallazgos del linter de copy (ver `references/copy.md`). | Reescribir. Las cifras van con fuente. |

- **Errores:** no se entrega con errores.
- **Advertencias:** se resuelven o se explican en una línea.
- **Límites de la medición:** el contraste se mide sobre el fondo real, pero ajuste de texto, superposición y espacio vacío son estimaciones. Que todo pase no reemplaza mirar la hoja de contacto.

## Exportación y entrega

**Qué archivo usar:**
- **PNG:** para piezas tipográficas y de color plano.
- **JPG** (95, croma 4:4:4): para piezas con foto. Instagram recomprime menos un JPG bien hecho.
- **`--scale 2`:** para entregas en 2K o impresión.
- **`--pdf`:** para carruseles de LinkedIn.
- **MP4:** para stories y reels.

**Mensaje de entrega por defecto:**

```
**[Título]** · 4:5 · 6 slides · v1 · 0 errores
Ángulo: [una frase]

[contact-sheet.png y/o los archivos]

Caption IG:
[caption]

[si aplica: una línea por advertencia aceptada o decisión que la persona podría no esperar]
¿Ajusto algo o la paso a aprobada?
```

Sin relato del proceso. Si elegiste algo que no te pidieron (foto en vez de tipografía, otro largo), lo decís en una línea.

## Revisión independiente

Después de que el render pase, pedí una revisión visual a alguien que no vio el proceso (`references/revision.md`). Los chequeos miden; no juzgan si la pieza es buena.

## Tests

`npx opentcy doctor` comprueba que los chequeos siguen detectando lo que deben (un slide con defectos a propósito) y que la librería de layouts pasa limpia. Corré los tests después de tocar cualquier script o `base.css`.
