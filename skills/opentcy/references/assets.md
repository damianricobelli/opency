# Imágenes y calidad de assets

Leé esto antes de usar una foto, un logo o buscar stock.

**Solo se usan imágenes registradas en `brands/<marca>/assets/assets.json`**, referenciadas con `<img data-asset="id" src="../../assets/…">`. Las URLs externas no se renderizan.

**Orden de preferencia:**
1. Fotos propias de la marca.
2. Texturas de la casa (`data-texture`: no necesitan archivo ni crédito).
3. Banco de imágenes: `npx opentcy assets stock "<búsqueda en inglés>"` consulta Pexels, Unsplash y Openverse a la vez (los que tengan clave; Openverse no la necesita). Después `stock-import <ref>`. El crédito y la licencia se registran solos.
4. Una URL que pasó la persona: `npx opentcy assets add <url>`.

**Buscar bien en un banco:**
- En inglés y concreto: sujeto, acción, encuadre y luz (`"barista pouring latte art close up natural light"`), no un sustantivo suelto.
- Con `--orientation portrait` para 4:5 y 9:16.
- Mirá las previews antes de elegir (`stock_search` las devuelve). Descartá lo que parezca foto de banco: sonrisas a cámara, apretones de manos, oficinas genéricas.
- Elegí por la columna de cobertura: `1080` o `2K` en el formato de la pieza. Menos que eso va en `photo-card`, no a sangre.
- Si la licencia es **CC BY** (Openverse), la atribución es obligatoria: copiá el `credit` de `assets.json` al final del caption.
- Dos búsquedas sin nada bueno: pedí una foto propia o resolvé con tipografía. Una foto mediocre empeora la pieza.

Importá solo la foto elegida, no la búsqueda entera. Si la persona pide fotos, eso manda sobre la preferencia por tipografía.

**Calidad al importar.** El script corrige la orientación, convierte a sRGB, quita metadatos (incluido el GPS), conserva la resolución completa e informa:
- **cobertura:** si alcanza para fondo completo 4:5 a 1080 o a 2K;
- **brillo:** clara, media u oscura (decide `ink` o `ink-inverse` y el velo);
- **paleta dominante.**

Si una foto no alcanza para fondo completo, va en un bloque más chico (`photo-card`), nunca agrandada: el render la marca como `image_upscaled`. Si un logo llega en bitmap chico, pedí el SVG.

**Logos.** No van al registro de fotos: se declaran en `brand.json → logos` (`onLight`, `onDark`, `onPrimary`, `icon`). `npx opentcy new` pone en cada slide la variante que corresponde a su superficie, y el render marca `logo_low_contrast` si el logo no se distingue de su fondo.

**Análisis obligatorio antes de usar una foto.**
1. Mirala.
2. Registrá el foco y las regiones protegidas, en coordenadas de 0 a 1 sobre la imagen original:
   ```
   npx opentcy assets analyze <id> --focal 0.52,0.38 --protect "face:0.44,0.2,0.14,0.18" --protect "hand:…" --done
   ```
   Tipos: `face`, `hand`, `subject`, `text` y `logo`. Una lista vacía con `--done` significa "la miré y no hay nada que proteger".
3. Usá el foco como `style="--fx:52%;--fy:38%"` en el `<img>`.

Con eso, el render avisa si el recorte corta una cara (error) o si un texto la tapa.

**Repetición.**
- La foto de portada no se repite nunca.
- Ninguna foto vuelve antes de 21 días (`npx opentcy feed` lo controla).
- Una foto que la persona rechazó se veta (`npx opentcy assets veto <id>`) y no vuelve a aparecer.

**Pocos recursos:**
- Sin foto, la composición es tipográfica, con materiales.
- Con una sola foto, va en la portada y el resto es tipográfico.
- Con un recorte o un logo, dejale aire.

**Inspiraciones.** Informan estructura y ritmo. Nunca entran a una pieza, y nunca copiás sus colores, tipografías, logos, fotos ni textos.
