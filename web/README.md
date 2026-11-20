# opency · web

The opency landing page. TanStack Start, shadcn/ui (Base UI, `base-maia` style), Tailwind v4, Paraglide.

English is the base language and lives at `/`; Spanish is a translation under `/es`.

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # dist/client + dist/server/server.js
pnpm typecheck
pnpm exec biome ci .
pnpm paraglide    # after editing src/i18n/messages/*.json
pnpm icons        # redraw the PNG icons in public/ from the mark
```

## Environment

| Variable | When | What it does |
| --- | --- | --- |
| `VITE_SITE_URL` | build time | The site's public URL, e.g. `VITE_SITE_URL=https://your-domain.example pnpm build`. Canonical, hreflang, Open Graph, JSON-LD, `sitemap.xml`, `robots.txt` and `llms.txt` use its origin. |

No domain is hardcoded. Without `VITE_SITE_URL`, every absolute URL uses the origin of the request that asked for the page, so local runs and preview deploys describe themselves. Set it in production: behind a proxy that rewrites the host, the request's origin is not the public one.

## SEO

- `src/lib/seo.ts`: `buildPublicSeoHead()` gives a route its title, description, canonical, `hreflang` alternates (with `x-default`), Open Graph and Twitter tags. List a new indexable page in `PUBLIC_SEO_ROUTES` and it joins the sitemap.
- `/api/og-image` (`/es/api/og-image` in Spanish): the 1200×630 card, drawn at request time with [Takumi](https://takumi.kane.tw) from JSX, with the landing's fonts bundled in the server. Each card is drawn once per process and cached in memory; clients keep it an hour.
- `/sitemap.xml`, `/robots.txt`, `/llms.txt`: server routes in `src/features/seo/routes`, so they carry the deployment's own origin.
- JSON-LD (`src/features/landing/lib/structured-data.ts`): `WebSite`, `Organization`, `SoftwareApplication` and `SoftwareSourceCode`. Only facts that can be checked in the repository.
- `public/site.webmanifest`, favicons and the Apple touch icon; `public/_headers` caches hashed assets on hosts that read that file. `src/server.ts` adds `nosniff`, a referrer policy and, over HTTPS, HSTS.

## Conventions

- New copy goes in both files under `src/i18n/messages/`, English first.
- Routes live in `src/features/<feature>/routes` (virtual routes in `src/routes.ts`).
- Deploys to Cloudflare Workers: `@cloudflare/vite-plugin` plus `wrangler.jsonc`, so the server runs in workerd in dev and in production. `pnpm deploy` builds and deploys; with Workers Builds set the root directory to `web`, the build command to `pnpm build` and the deploy command to `npx wrangler deploy`.
- The hero shows the demo carousel's real renders (`public/hero/`, refreshed with `pnpm hero-slides`) and animates with CSS only (`.hero-stage` in `styles.css`): no WebGL, nothing to lazy-load, and a static version under `prefers-reduced-motion`.
