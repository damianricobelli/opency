# Reporte de calidad — defects

4:5 · 1 slide(s) · ×1 · 7 errores · 11 advertencias

## Slide 1 (flat)
- aviso `outside_safe_area` #out — texto fuera de la zona segura
- aviso `illegible_text_size` #tiny — 14 px en canvas = 5.1 pt en el teléfono (mín. 10.5)
- **ERROR** `headline_orphan` #headline — última línea con una sola palabra: "sola"
- **ERROR** `critical_overlap` #a — se superpone con #b
- **ERROR** `external_image` img — imagen externa: descargala a assets/ y registrala (npx opentcy assets add)
- **ERROR** `missing_asset` img — no cargó https://example.com/foto.jpg
- **ERROR** `placeholder_left`  — quedan marcadores {{…}}
- aviso `over_budget` #headline — 43 caracteres; este layout está dibujado para ~20. Acortá o cambiá de layout (no achiques la letra)
- **ERROR** `request_failed`  — no cargó https://example.com/foto.jpg
- aviso `unreadable_contrast` #low — contraste 4.18:1 (mín. 4.5:1)
- aviso `brand_literal_color`  — colores fuera de tokens: #777777

## Copy y captions
- aviso `copy_emoji` slide 1 #claim — emoji: la marca no los usa
- **ERROR** `unsourced_figure` slide 1 #claim — "40%": cifra sin fuente. Tiene que estar en brand.json (verified) o en piece.sources con esa cifra
- aviso `copy_ai_phrase:apertura_gastada` caption instagram — "¿Sabías que" — reemplazar por un hecho concreto en palabras de la marca
- aviso `copy_too_many_hashtags` caption instagram — 4 hashtags (máx. 3)
- aviso `copy_filler_hashtags` caption instagram — hashtags de relleno: #love #fyp #viral #marketing
- aviso `copy_generic_cta` caption instagram — CTA genérico: "Más info" — nombrar el objeto (qué, dónde, cómo)
- aviso `missing_alt_text` slides 1 — falta texto alternativo (accesibilidad; Instagram y LinkedIn lo aceptan)
