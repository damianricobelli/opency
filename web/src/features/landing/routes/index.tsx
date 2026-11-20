import { createFileRoute } from "@tanstack/react-router";
import { buildPublicSeoHead } from "@/lib/seo";
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
import { landingStructuredData } from "../lib/structured-data";

export const Route = createFileRoute("/")({
  head: () => {
    const locale = getLocale();
    return {
      ...buildPublicSeoHead({
        path: "/",
        variant: "landing",
        locale,
        title: m.meta_title(),
        description: m.meta_description(),
        imageAlt: m.og_image_alt(),
      }),
      scripts: landingStructuredData(locale).map((data) => ({
        type: "application/ld+json",
        children: JSON.stringify(data),
      })),
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
