import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    dedupe: ["react", "react-dom", "three"],
  },
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      // The URL decides (`/` is Spanish, `/en` English); the cookie only
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
