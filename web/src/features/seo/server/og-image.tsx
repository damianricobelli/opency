import "@tanstack/react-start/server-only";

import serifItalicData from "@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?inline";
import serifData from "@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?inline";
import geistData from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?inline";
import monoData from "@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2?inline";
import { ImageResponse } from "takumi-js/response";
import type { AppLocale } from "@/i18n";
import {
  OG_BROWSER_CACHE_CONTROL,
  OG_HEIGHT,
  OG_WIDTH,
  ogImageFailure,
} from "@/lib/og-image";
import { type OgImageVariant, PUBLIC_SEO_ROUTES } from "@/lib/seo";
import { GITHUB_URL, SITE_NAME } from "@/lib/site";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

/** A bundled `?inline` asset (a data URL) as the bytes Takumi reads. */
function bytesOf(dataUrl: string): Uint8Array {
  return Uint8Array.from(
    atob(dataUrl.slice(dataUrl.indexOf(",") + 1)),
    (char) => char.charCodeAt(0),
  );
}

// The landing's own faces, shipped in the server bundle: the card never
// waits on a font CDN, and it reads like the page it links to.
const SERIF = "Instrument Serif";
const SANS = "Geist";
const MONO = "JetBrains Mono";
const OG_FONTS = [
  { name: SERIF, data: bytesOf(serifData), weight: 400, style: "normal" },
  { name: SERIF, data: bytesOf(serifItalicData), weight: 400, style: "italic" },
  { name: SANS, data: bytesOf(geistData), style: "normal" },
  { name: MONO, data: bytesOf(monoData), style: "normal" },
];

/** The light scheme's tokens (`styles.css`), as the sRGB a PNG needs. */
const COLOR = {
  background: "#faf9f7",
  card: "#fefdfc",
  foreground: "#1a1917",
  muted: "#63605b",
  border: "#dedcd7",
  brand: "#e2512b",
} as const;

const OG_VARIANTS: readonly OgImageVariant[] = PUBLIC_SEO_ROUTES.map(
  (route) => route.variant,
);

type OgImageCopy = {
  eyebrow: string;
  titleLines: [string, string];
  description: string;
};

function isOgImageVariant(value: string | null): value is OgImageVariant {
  return value !== null && OG_VARIANTS.includes(value as OgImageVariant);
}

function copyForVariant(
  variant: OgImageVariant,
  locale: AppLocale,
): OgImageCopy {
  switch (variant) {
    case "landing":
      return {
        eyebrow: m.hero_eyebrow({}, { locale }),
        titleLines: [
          m.og_title_line_1({}, { locale }),
          m.og_title_line_2({}, { locale }),
        ],
        description: m.og_description({}, { locale }),
      };
  }
}

/** The mark from the header: a 4:5 slide with the accent dot. */
function Mark({ height }: { height: number }) {
  const width = height * 0.8;
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width,
        height,
        borderRadius: height * 0.24,
        backgroundColor: COLOR.foreground,
      }}
    >
      <div
        style={{
          position: "absolute",
          right: height * 0.15,
          bottom: height * 0.15,
          width: height * 0.3,
          height: height * 0.3,
          borderRadius: 9999,
          backgroundColor: COLOR.brand,
        }}
      />
    </div>
  );
}

function buildOgElement(copy: OgImageCopy) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        padding: "64px 76px 0",
        backgroundColor: COLOR.background,
        // The hero's hairline grid.
        backgroundImage: `linear-gradient(90deg, ${COLOR.border}99 1px, transparent 1px), linear-gradient(${COLOR.border}99 1px, transparent 1px)`,
        backgroundSize: "72px 72px, 72px 72px",
        color: COLOR.foreground,
        fontFamily: SANS,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Mark height={46} />
          <div style={{ fontFamily: SERIF, fontSize: 52, lineHeight: 1 }}>
            {SITE_NAME}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "11px 20px",
            border: `1px solid ${COLOR.border}`,
            borderRadius: 9999,
            backgroundColor: COLOR.card,
            color: COLOR.muted,
            fontFamily: MONO,
            fontSize: 19,
            lineHeight: 1,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 9999,
              backgroundColor: COLOR.brand,
            }}
          />
          <div>{copy.eyebrow}</div>
        </div>
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: 84,
          fontFamily: SERIF,
          fontSize: 86,
          lineHeight: 1.02,
          letterSpacing: "-1.5px",
        }}
      >
        <div>{copy.titleLines[0]}</div>
        <div style={{ color: COLOR.brand, fontStyle: "italic" }}>
          {copy.titleLines[1]}
        </div>
      </div>
      <div
        style={{
          maxWidth: 940,
          marginTop: 34,
          color: COLOR.muted,
          fontSize: 28,
          lineHeight: 1.35,
        }}
      >
        {copy.description}
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 50,
          color: COLOR.muted,
          fontFamily: MONO,
          fontSize: 19,
        }}
      >
        {GITHUB_URL.replace("https://", "")}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: 10,
          backgroundColor: COLOR.foreground,
        }}
      />
    </div>
  );
}

async function renderVariant(
  variant: OgImageVariant,
  locale: AppLocale,
): Promise<Uint8Array> {
  const response = new ImageResponse(
    buildOgElement(copyForVariant(variant, locale)),
    { width: OG_WIDTH, height: OG_HEIGHT, format: "png", fonts: OG_FONTS },
  );
  await response.ready;
  return new Uint8Array(await response.arrayBuffer());
}

/**
 * A card depends only on its variant, its language and the build, so each
 * one is drawn once per server process and answered from memory after.
 */
const rendered = new Map<string, Promise<Uint8Array>>();

export async function renderOpenGraphImage(
  request: Request,
): Promise<Response> {
  const requestedVariant = new URL(request.url).searchParams.get("variant");
  const variant = isOgImageVariant(requestedVariant)
    ? requestedVariant
    : "landing";
  // The card's language is its URL's: `/es/api/og-image` is the Spanish one.
  const locale = getLocale();
  const key = `${variant}:${locale}`;
  try {
    let card = rendered.get(key);
    if (!card) {
      card = renderVariant(variant, locale);
      rendered.set(key, card);
    }
    const bytes = await card;
    return new Response(bytes.slice().buffer, {
      headers: {
        "Cache-Control": OG_BROWSER_CACHE_CONTROL,
        "Content-Length": String(bytes.byteLength),
        "Content-Type": "image/png",
      },
    });
  } catch (error) {
    // A failed card is never kept: the next request draws it again.
    rendered.delete(key);
    console.error("Failed to render Open Graph image", {
      variant,
      locale,
      error: error instanceof Error ? error.message : String(error),
    });
    return ogImageFailure();
  }
}
