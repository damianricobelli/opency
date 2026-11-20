import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

/**
 * Base UI ships the script that places a server-rendered tab indicator before
 * React hydrates behind a `browser` import condition that swaps it for an
 * empty stub. The Worker renders with browser conditions too, so the server
 * got the stub and the install tabs painted without their active pill until
 * hydration. On the server, `#prehydration/*` resolves to the real script.
 */
function baseUiPrehydrationScripts(): Plugin {
  const packageMarker = "/@base-ui/react/";
  return {
    name: "opency:base-ui-prehydration-scripts",
    resolveId(source, importer) {
      if (!source.startsWith("#prehydration/") || !importer) return null;
      const at = importer.lastIndexOf(packageMarker);
      if (at < 0) return null;
      const packageRoot = importer.slice(0, at + packageMarker.length - 1);
      const imports = JSON.parse(
        readFileSync(join(packageRoot, "package.json"), "utf8"),
      ).imports as
        | Record<string, { default?: { import?: { default?: string } } }>
        | undefined;
      const target = imports?.[source]?.default?.import?.default;
      return target ? join(packageRoot, target) : null;
    },
  };
}

const config = defineConfig({
  define: {
    // Sitemap `<lastmod>`: the page changes with deploys.
    "import.meta.env.BUILD_DATE": JSON.stringify(
      new Date().toISOString().slice(0, 10),
    ),
  },
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom"],
  },
  environments: {
    ssr: {
      optimizeDeps: {
        rolldownOptions: { plugins: [baseUiPrehydrationScripts()] },
      },
    },
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      // The URL decides (`/` is English, `/es` Spanish); the cookie only
      // remembers the language someone picked.
      strategy: ["url", "cookie", "baseLocale"],
      // Physical files instead of Paraglide 3's virtual modules, so `tsc`
      // resolves them without Vite: one per locale while developing, one per
      // message in production builds.
      outputStructure:
        process.env.NODE_ENV === "production"
          ? "message-modules"
          : "locale-modules",
    }),
    // The server runs in workerd, in dev and in production (wrangler.jsonc).
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    {
      ...baseUiPrehydrationScripts(),
      enforce: "pre",
      applyToEnvironment: (environment) => environment.name === "ssr",
    },
    tailwindcss(),
    tanstackStart({
      router: {
        generatedRouteTree: resolve(appDirectory, "src/routeTree.gen.ts"),
        routesDirectory: resolve(appDirectory, "src"),
        virtualRouteConfig: "./src/routes.ts",
      },
    }),
    viteReact(),
  ],
});

export default config;
