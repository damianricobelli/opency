# opentcy · web

Landing de opentcy. TanStack Start, shadcn/ui (Base UI, estilo `base-maia`), Tailwind v4, Paraglide (es en `/`, en en `/en`) y una escena de React Three Fiber en el hero.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # dist/client + dist/server/server.js
pnpm typecheck
pnpm exec biome ci .
pnpm paraglide    # después de editar src/i18n/messages/*.json
```

- Texto nuevo va en los dos archivos de `src/i18n/messages/`.
- Las rutas viven en `src/features/<feature>/routes` (rutas virtuales en `src/routes.ts`).
- three.js se carga aparte, en idle y solo en el navegador (`hero-stage.tsx`); con `prefers-reduced-motion` o sin WebGL queda el abanico en CSS.
