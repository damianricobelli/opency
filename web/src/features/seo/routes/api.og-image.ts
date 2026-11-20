import { createFileRoute } from "@tanstack/react-router";
import { OG_BROWSER_CACHE_CONTROL } from "@/lib/og-image";

export const Route = createFileRoute("/api/og-image")({
  server: {
    handlers: {
      HEAD: () =>
        new Response(null, {
          headers: {
            "Cache-Control": OG_BROWSER_CACHE_CONTROL,
            "Content-Type": "image/png",
          },
        }),
      GET: async ({ request }) => {
        // The renderer (Takumi and its fonts) loads only when a card is asked for.
        const { renderOpenGraphImage } = await import(
          "@/features/seo/server/og-image"
        );
        return renderOpenGraphImage(request);
      },
    },
  },
});
