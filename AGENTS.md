# opentcy · guía para trabajar en este repo

Este repositorio es el código de **opentcy**: un skill y un servidor MCP que convierten a un agente en el equipo de contenido de una agencia.

- **¿Venís a hacer piezas o campañas?** Las instrucciones están en `skills/opentcy/SKILL.md` (el repo también funciona como workspace: tiene `brands/` y `templates/`). Usá `node bin/opentcy.mjs <comando>` en lugar de `npx opentcy`.
- **¿Venís a cambiar opentcy?** Seguí leyendo.

## Mapa

```
bin/opentcy.mjs              CLI: despacha a scripts/ y arranca el MCP
scripts/                     el motor (cada archivo es un comando)
  lib/project.mjs            rutas (PKG vs workspace), formatos, marcas, navegador
  lib/brief.mjs              las preguntas del brief: fuente única para CLI, MCP y docs
  lib/stock.mjs              Pexels, Unsplash, Openverse y descarga segura
  lib/copy-lint.mjs          linter de copy
  test/                      node --test
mcp/server.mjs               servidor MCP (stdio): cada herramienta ejecuta un script del motor
skills/opentcy/              SKILL.md + references/: lo que lee el agente
agents/revisor-visual.md     subagente de revisión en frío
templates/                   base.css y los 14 layouts
brands/_demo/                marca de ejemplo (la única que se versiona)
.claude-plugin/              manifiesto de plugin y marketplace de Claude Code
web/                         landing (TanStack Start); proyecto aparte, con su propio package.json
```

## Reglas

- **Una sola implementación.** El MCP no reimplementa nada: llama al mismo script que el CLI. Si agregás una capacidad, va primero en `scripts/` y después se expone en `mcp/server.mjs` y se documenta en `skills/opentcy/`.
- **Las preguntas del brief viven en `scripts/lib/brief.mjs`.** No las dupliques en la documentación: `references/brief.md` explica cómo preguntar, no qué.
- **PKG vs ROOT.** `PKG` es donde está instalado opentcy; `ROOT` es el workspace de la persona (`OPENTCY_HOME` o la carpeta con `brands/`). Lo que la persona edita se lee de `ROOT`.
- **Nada que publique en redes** ni automatizaciones no oficiales contra ellas.
- **Toda descarga pasa por `fetchBuffer`** de `lib/stock.mjs`, que rechaza direcciones privadas.
- Mensajes al usuario en español rioplatense, como el resto del motor.
- `npm test` antes de terminar. `OPENTCY_TEST_NETWORK=1 npm test` suma la prueba de stock en vivo.
- `brands/*` está en `.gitignore` salvo `_demo`: no subas marcas reales.
