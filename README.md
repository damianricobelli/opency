# opentcy

**Tu agente como equipo de contenido de una agencia.** Un skill y un servidor MCP open source que convierten a Claude Code, Claude Desktop, Cursor, Codex o cualquier cliente MCP en ejecutivo de cuentas, director de arte, diseñador y redactor.

Te pregunta qué querés transmitir antes de diseñar. Arma la campaña con la identidad de tu marca. Busca fotos en Pexels, Unsplash y Openverse. Renderiza cada pieza y la controla a nivel píxel. Vos aprobás lo que sale.

Todo corre en tu máquina y todo son archivos tuyos: HTML/CSS por slide, PNG/JPG/PDF/MP4 listos para subir. Sin cuenta, sin límite de descargas, sin SaaS.

```
> Quiero una campaña para el lanzamiento del cold brew

  ¿Qué querés transmitir? Si alguien se acuerda de una sola cosa, ¿cuál tiene que ser?
  ¿Qué tiene que pasar para que digas que funcionó?
  ¿Dónde va a salir?  ¿Con qué imágenes contamos?

  Entonces: "el café frío también es de especialidad". Te propongo 5 piezas…
```

## Instalación

Requiere Node 18.17+. Para video, ffmpeg.

**1. El skill** (las instrucciones que sigue el agente):

```bash
npx skills add damianricobelli/opentcy
```

**2. El workspace** (donde viven tus marcas y piezas):

```bash
npx opentcy init mi-agencia
```

```bash
npx opentcy setup
```

**3. El servidor MCP** (opcional en Claude Code y Cursor, que ya pueden correr los comandos; necesario en clientes sin terminal, como Claude Desktop):

```bash
claude mcp add opentcy -- npx -y opentcy mcp
```

En cualquier otro cliente:

```json
{
  "mcpServers": {
    "opentcy": {
      "command": "npx",
      "args": ["-y", "opentcy", "mcp"],
      "env": { "OPENTCY_HOME": "/ruta/a/mi-agencia" }
    }
  }
}
```

**Como plugin de Claude Code** (skill + MCP + subagente revisor en un paso):

```
/plugin marketplace add damianricobelli/opentcy
/plugin install opentcy@opentcy
```

## Uso

Abrí el workspace con tu agente y pedí:

> Cargá mi marca desde misitio.com.
> Armá una campaña para el lanzamiento de diciembre.
> Carrusel sobre automatizar reportes, 6 slides, para el jueves.
> Adaptalo a story y armá el video.
> Proponeme el plan de la semana.

## Cómo trabaja

1. **Brief.** Antes de una campaña o de cargar una marca, pregunta lo que necesita saber, de a tandas cortas: qué querés transmitir, objetivo, audiencia, oferta, tono, canales, fechas, imágenes. Lo que puede deducir de la marca o de la web no lo pregunta. Con MCP, las preguntas llegan como formulario.
2. **Marca.** Lee colores, tipografías, logo y textos de una web y propone 7 roles de color, 3 familias, voz con reglas duras y datos verificados. Escribe cuando decís que sí. Varias marcas en un mismo workspace.
3. **Plan.** Cada pieza de la campaña prueba el mensaje desde un ángulo distinto. Lo aprobás antes de que se diseñe nada.
4. **Imágenes.** Fotos propias primero. Después, banco: busca en Pexels, Unsplash y Openverse a la vez, mira las previews, importa solo la elegida a resolución completa y registra autor y licencia. Marca el foco y las caras para no cortarlas.
5. **Piezas.** HTML/CSS con los tokens de la marca, sobre 14 layouts probados. Formatos 4:5, 1:1, 9:16 y 16:9. Captions por red, alt text, PDF para LinkedIn y video MP4.
6. **Control de calidad.** Mide sobre el render real, no sobre el código.
7. **Revisión en frío.** Un subagente que no vio el proceso mira la hoja de contacto y devuelve hasta 5 hallazgos.
8. **Vos decidís.** opentcy nunca publica solo.

## Qué controla el render

- **Contraste píxel a píxel**, también sobre fotos y degradados, y contraste del logo contra su fondo.
- **Texto:** viudas en titulares, superposición, recortes, tamaño ilegible en teléfono y presupuesto de caracteres de cada layout.
- **Zonas:** zona segura y franja que tapa la interfaz de cada red.
- **Composición:** contenido amontonado o hundido, espacio muerto y exceso de acento.
- **Coherencia entre slides:** barra inferior que se mueve, texturas mezcladas, el mismo layout repetido.
- **Fotos:** agrandadas más allá de su resolución, recortes que cortan caras, texto sobre el sujeto, imágenes sin registrar o vetadas.
- **Marca:** colores fuera de los tokens y fuentes que no cargaron.
- **Copy:** frases "de IA", trato mezclado, bajadas que repiten el titular, cifras sin fuente (cifra por cifra), hashtags de relleno, CTA genéricos, límites por red y alt text faltante.

## Herramientas MCP

| Grupo | Herramientas |
|---|---|
| Workspace | `workspace_status` · `workspace_init` · `doctor` · `skill_guide` |
| Marca | `brand_list` · `brand_get` · `brand_create` · `brand_use` · `brand_import_site` · `brand_check` · `brand_write` |
| Brief | `brief_questions` · `brief_interview` |
| Campañas | `campaign_create` · `campaign_brief` · `campaign_plan` · `campaign_status` · `campaign_list` |
| Imágenes | `stock_search` · `stock_import` · `asset_add` · `asset_analyze` · `asset_view` · `asset_list` · `asset_veto` |
| Piezas | `layouts_list` · `piece_create` · `piece_list` · `piece_read` · `piece_write` · `piece_render` · `piece_view` · `piece_version` · `piece_motion` |
| Feed y resultados | `feed_check` · `results_add` · `results_summary` |

Además: las instrucciones del skill como recursos (`opentcy://guide/…`) y tres prompts (`nueva-campana`, `cargar-marca`, `plan-semanal`).

Las herramientas que renderizan o buscan devuelven **imágenes**, no solo texto: el agente ve la hoja de contacto y las previews del banco antes de decidir. `brief_interview` usa *elicitation* de MCP cuando el cliente la soporta y, si no, devuelve las preguntas para el chat.

## Bancos de imágenes

| Banco | Clave | Licencia |
|---|---|---|
| [Openverse](https://openverse.org) | No necesita | Solo CC0, dominio público y CC BY (la atribución queda registrada) |
| [Pexels](https://www.pexels.com/api/) | `PEXELS_API_KEY` (gratis) | Pexels License |
| [Unsplash](https://unsplash.com/developers) | `UNSPLASH_ACCESS_KEY` (gratis) | Unsplash License |

Con las claves en el entorno (o en la config del servidor MCP), la búsqueda consulta todos en paralelo e intercala los resultados.

## Comandos

| Comando | Qué hace |
|---|---|
| `npx opentcy init [carpeta]` | Crea un workspace |
| `npx opentcy setup` · `doctor` | Instala el navegador del render · verifica el entorno |
| `npx opentcy mcp` | Servidor MCP (stdio) |
| `npx opentcy brief questions [brand\|campaign\|piece]` | Las preguntas de cada brief |
| `npx opentcy campaign new / brief / plan / status / list` | Campañas |
| `npx opentcy brand list / use / new / import <url> / check` | Marcas |
| `npx opentcy new <slug> --layouts cover-type,steps,closer` | Pieza nueva (`--campaign`, `--from`, `--format`) |
| `npx opentcy render <pieza>` | PNG, JPG, hoja de contacto, captions y reporte (`--pdf`, `--scale 2`) |
| `npx opentcy dev <pieza>` | Vista previa con recarga y textos editables |
| `npx opentcy version <pieza> save / list / diff / restore` | Versiones, sin depender de git |
| `npx opentcy motion <pieza> --slides all --audio pista.mp3` | Video MP4 |
| `npx opentcy assets add / stock / stock-import / analyze / veto / list` | Imágenes |
| `npx opentcy feed` · `results` | Ritmo del feed · qué rindió mejor |

Todos aceptan `--brand <slug>`. El workspace es la carpeta con `brands/`, o la que indique `OPENTCY_HOME`.

## Límites conocidos

- **Publicación:** opentcy no publica en redes. Deja todo listo en `render/`, o usa el MCP de publicación que conectes (Buffer, Metricool, Postiz…), con tu confirmación en cada envío.
- **Generación de imágenes:** no incluye un modelo. Trabaja con tus fotos, bancos de imágenes y tipografía.
- **Pexels y Unsplash:** implementados según su API, pero las pruebas automáticas solo cubren Openverse (no requiere clave).
- **Fotos con personas:** el control de recortes de caras depende de que el agente marque bien las regiones.
- **Video:** sin subtítulos automáticos ni locución.
- **Idioma:** las instrucciones y el linter de copy están en español. Las piezas pueden estar en cualquier idioma; los chequeos de copy son más finos en español.

## Desarrollo

```bash
npm install
npm test                          # motor + servidor MCP
OPENTCY_TEST_NETWORK=1 npm test   # suma la prueba de stock en vivo
```

La landing está en [`web/`](web) (TanStack Start). Guía para contribuir: [CONTRIBUTING.md](CONTRIBUTING.md).

## Licencia

[MIT](LICENSE).
