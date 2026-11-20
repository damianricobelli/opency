# Cargar una marca

Leé esto cuando `brand.json` no existe o tiene marcadores `{{…}}`, o cuando la persona pide cambiar la marca.

Pedí lo mínimo y deducí el resto: web, Instagram, manual de marca, logo, posts anteriores, Figma.

**Primero proponé y después escribí.** Mostrá en texto la paleta con sus roles, las tipografías, la voz y 2–3 reglas duras. Escribí `brand.json`, `brand-kit.md` y `tokens.css` solo cuando la persona diga que sí. Antes de cambiar una marca ya cargada, copiá `tokens.css` y `brand.json` a `brands/<marca>/history/AAAA-MM-DD/` para poder deshacer.

**Pasos**

1. `npx opentcy brand new <slug> --name "Nombre"` crea `brands/<slug>/` con tokens neutros.
2. Si hay web: `npx opentcy brand import <url> --brand <slug>`. Deja en `import/report.json` los colores por superficie, las tintas, las tipografías, el logo y los textos. Mirá también `import/home.png`.
3. Proponé los 7 roles, las 3 familias, la voz y los datos verificados. Esperá el sí.
4. Escribí los archivos. Las fuentes van en `assets/fonts/` (variables o por peso) y los logos en `assets/logos/`, declarados en `brand.json → logos`.
5. `npx opentcy brand check --brand <slug>`: tiene que terminar sin problemas. Te dice qué combinaciones sirven para texto y cuál debe ser `--on-accent`.
6. Hacé una pieza de prueba y renderizala.

**Dónde va cada cosa**

- `brand.json`: lo que leen los scripts. Nombre, handle, idioma, país, trato (`address`), si usa emoji o guiones largos, pilares, logos, valores por defecto (textura, tratamiento de foto) y `verified` (datos con fuente y fecha).
- `brand-kit.md`: lo que leés vos. Voz con reglas duras, roles de color explicados, perfil creativo, instrucciones vigentes y los supuestos que faltan confirmar.
- `tokens.css`: los valores reales.
- `voice-samples.md`: textos reales de la marca.

**Qué tiene que quedar cargado**

- **Identidad:** nombre, qué hace, para quién, objetivo de las redes, oferta, idioma y país (para el calendario comercial).
- **Pilares de contenido:** 3–5 temas recurrentes. El plan semanal rota entre ellos.
- **Voz:** reglas duras en vez de adjetivos ("frases de menos de 12 palabras", "nunca signos de exclamación", "trato de vos"). La voz manda sobre tus preferencias en tono, largo y puntuación.
- **Muestras de voz:** hasta 5 textos reales de la marca, de hasta 600 caracteres cada uno, copiados textuales. Nunca inventados ni parafraseados.
- **7 roles de color:** `primary`, `secondary`, `accent`, `bg`, `bg-alt`, `ink` e `ink-inverse`.
  - `ink` va sobre `bg`.
  - `ink-inverse` va sobre fotos, sobre `primary` y sobre paneles oscuros.
  - `accent` se usa una vez por slide y cubre menos del 10 % de la superficie.
  - Verificá el contraste AA de cada combinación de texto sobre fondo antes de proponerla.
- **3 familias tipográficas:** `display` (titulares), `body` (texto) y `mono` (etiquetas chicas en mayúscula).
  - Pedí los archivos `.woff2` y guardalos en `assets/fonts/`.
  - Declarás solo los pesos que tienen archivo. Un peso o una itálica sintética no es la fuente original, y nunca lo presentás como tal.
- **Logo:** pedilo en SVG, con variantes primaria, isotipo y wordmark, y versión clara y oscura.
- **Instrucciones vigentes**, en tres alcances:
  - `general`: siempre aplica.
  - `campaña`: con fecha de vencimiento.
  - `próximas`: lanzamientos y fechas que vienen.
  - Solo se guardan cuando la persona pide explícitamente recordar, cambiar o borrar una regla. Un deseo puntual para una pieza no es una instrucción.
- **Datos verificados** (`brand.json → verified`): precios, resultados, clientes y testimonios con permiso, cada uno con fuente y fecha. Nombrar a un cliente requiere su permiso, aunque figure en la web.
- **Marcas monocromas:** si el acento es el mismo color que `primary`, definí `--accent-inverse` (el acento sobre paneles oscuros) y `--on-accent`.
- **Supuestos:** todo lo que dedujiste sin confirmación va listado al final de `brand-kit.md`, y se lo decís a la persona.

Cerrá el onboarding con una pieza de prueba renderizada.
