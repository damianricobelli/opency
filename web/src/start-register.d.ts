// The Start plugin appends this registration to `routeTree.gen.ts` while it
// runs (dev, build). The plain `tsr generate` behind `pnpm typecheck` does
// not, and without it routes lose the types of their `server` handlers.
import type { createStart } from "@tanstack/react-start";
import type { getRouter } from "./router";

declare module "@tanstack/react-start" {
  interface Register {
    ssr: true;
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}

export type StartInstance = ReturnType<typeof createStart>;
