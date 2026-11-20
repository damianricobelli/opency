# Plantillas compartidas

- **`base/`:** la infraestructura común a todas las marcas.
  - `base.css` define el canvas, las zonas por formato, la escala tipográfica por rol, los materiales (texturas, fotos, velos, scrim, glass, chips) y el movimiento.
  - `slide.html` es el slide en blanco.
- **`layouts/`:** 14 arquetipos de slide probados con el control de calidad. Ver su README.

Las plantillas propias de cada marca (piezas aprobadas) viven en `brands/<marca>/templates/<nombre>/`.

`npx opentcy new` copia los slides a `brands/<marca>/pieces/<id>/` y ajusta las rutas a los tokens, los assets y el logo de esa marca. Los layouts se renderizan con la marca `_demo`.
