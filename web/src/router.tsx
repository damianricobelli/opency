import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { deLocalizeUrl, localizeUrl } from "@/paraglide/runtime";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    // The landing glides its anchor links (scroll-behavior: smooth); restoring
    // the scroll after a reload must not inherit that.
    scrollRestorationBehavior: "instant",
    defaultPreload: "intent",
    // Routes are written once, without a locale: `/en/…` is matched as `/…`
    // and links are written back with the current locale's prefix.
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
