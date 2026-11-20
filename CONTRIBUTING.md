# Contribuir

Gracias por sumar. opentcy quiere ser el skill y el MCP de referencia para equipos de contenido: cualquier mejora que acerque una pieza a "lista para publicar" es bienvenida.

## Preparar el entorno

```bash
git clone https://github.com/damianricobelli/opentcy
cd opentcy
npm install
node bin/opentcy.mjs setup     # navegador para el render
npm test
```

El repo es a la vez el paquete y un workspace de prueba: `node bin/opentcy.mjs new prueba --brand _demo --layouts cover-type,closer`.

## Qué aportar

| Aporte | Dónde |
|---|---|
| Un layout nuevo | `templates/layouts/` (slide + entrada en `piece.json` + fila en el README). Tiene que pasar `node bin/opentcy.mjs layouts` con 0 errores y 0 advertencias. |
| Un chequeo de calidad | `scripts/render.mjs` o `scripts/lib/copy-lint.mjs`, con su caso en `scripts/test/`. |
| Un banco de imágenes | Un proveedor más en `scripts/lib/stock.mjs` (`search` y `get`). Solo licencias que permitan uso comercial y modificación. |
| Una herramienta MCP | Primero el comando en `scripts/`; después se expone en `mcp/server.mjs` y se documenta en `skills/opentcy/SKILL.md`. |
| Otro idioma para el skill o el linter | Abrí un issue antes: hay que decidir cómo se organiza. |

## Antes del PR

- `npm test` pasa.
- Si tocaste `base.css` o un layout: `node bin/opentcy.mjs layouts` y mirá la hoja de contacto.
- No incluyas marcas reales, claves ni fotos sin licencia.
- Un PR, un tema.
