import { physical, rootRoute } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("routes/__root.tsx", [
  physical("features/landing/routes"),
]);
