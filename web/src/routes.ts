import { physical, rootRoute, route } from "@tanstack/virtual-file-routes";

export const routes = rootRoute("routes/__root.tsx", [
  route("/api/og-image", "features/seo/routes/api.og-image.ts"),
  route("/sitemap.xml", "features/seo/routes/sitemap.ts"),
  route("/robots.txt", "features/seo/routes/robots.ts"),
  route("/llms.txt", "features/seo/routes/llms.ts"),
  physical("features/landing/routes"),
]);
