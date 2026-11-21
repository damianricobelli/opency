import type { AppLocale } from "@/i18n";
import { locales } from "@/i18n";
import { ogImageUrl, publicPageUrl } from "@/lib/seo";
import {
  GITHUB_OWNER,
  GITHUB_OWNER_URL,
  GITHUB_URL,
  LICENSE_URL,
  SITE_NAME,
} from "@/lib/site";
import { currentSiteOrigin } from "@/lib/site-origin";
import { m } from "@/paraglide/messages";

/**
 * What search engines read as facts about the page. Only what is true and
 * checkable in the repository: no ratings, reviews or user counts.
 */
export function landingStructuredData(locale: AppLocale) {
  const origin = currentSiteOrigin();
  const description = m.meta_description();

  const author = {
    "@type": "Person",
    "@id": `${GITHUB_OWNER_URL}#person`,
    name: GITHUB_OWNER,
    url: GITHUB_OWNER_URL,
  };

  // Who publishes the site; its logo is what a knowledge panel would show.
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE_NAME,
    url: `${origin}/`,
    logo: `${origin}/web-app-manifest-512x512.png`,
    sameAs: [GITHUB_URL],
    founder: author,
  };

  // Google reads the site name shown above the URL in results from this.
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: SITE_NAME,
    url: `${origin}/`,
    inLanguage: [...locales],
    publisher: { "@id": `${origin}/#organization` },
  };

  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${origin}/#software`,
    name: SITE_NAME,
    url: publicPageUrl("/", locale),
    description,
    image: ogImageUrl("landing", locale),
    inLanguage: locale,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Marketing automation",
    operatingSystem: "Cross-platform",
    softwareRequirements: "Node.js, Google Chrome",
    // What the page itself shows, in the page's language.
    featureList: [
      m.setup_title(),
      m.compose_title(),
      m.compose_fact_2(),
      m.compose_fact_3(),
      m.quality_title(),
      m.mcp_title(),
    ],
    license: LICENSE_URL,
    isAccessibleForFree: true,
    downloadUrl: GITHUB_URL,
    author,
    publisher: { "@id": `${origin}/#organization` },
    offers: {
      "@type": "Offer",
      price: 0,
      priceCurrency: "USD",
    },
  };

  const sourceCode = {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    "@id": `${GITHUB_URL}#code`,
    name: SITE_NAME,
    description,
    codeRepository: GITHUB_URL,
    programmingLanguage: "JavaScript",
    runtimePlatform: "Node.js",
    license: LICENSE_URL,
    author,
    targetProduct: { "@id": `${origin}/#software` },
  };

  return [website, organization, softwareApplication, sourceCode];
}
