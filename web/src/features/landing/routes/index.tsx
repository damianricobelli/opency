import { createFileRoute } from "@tanstack/react-router";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { BriefSection } from "../components/brief-section";
import { FlowSection } from "../components/flow-section";
import { Hero } from "../components/hero";
import { InstallSection } from "../components/install-section";
import { McpSection } from "../components/mcp-section";
import { QualitySection } from "../components/quality-section";
import { ClosingSection, SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import { WhySection } from "../components/why-section";

const OG_LOCALES = { es: "es_AR", en: "en_US" } as const;

export const Route = createFileRoute("/")({
  head: () => {
    const title = m.meta_title();
    const description = m.meta_description();
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "opentcy" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:locale", content: OG_LOCALES[getLocale()] },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background"
      >
        {m.skip_to_content()}
      </a>
      <SiteHeader />
      <main id="main">
        <Hero />
        <BriefSection />
        <FlowSection />
        <QualitySection />
        <McpSection />
        <InstallSection />
        <WhySection />
        <ClosingSection />
      </main>
      <SiteFooter />
    </>
  );
}
