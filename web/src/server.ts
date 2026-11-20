import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { paraglideMiddleware } from "@/paraglide/server.js";

// Paraglide resolves the request's locale (URL, then cookie, then Spanish)
// before the router renders, so `getLocale()` is right during SSR.
export default createServerEntry({
  fetch(request) {
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
});
