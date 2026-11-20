import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { m } from "@/paraglide/messages";
import { INSTALL_COMMANDS } from "../lib/site";
import { CodeBlock } from "./code-block";
import { Reveal } from "./reveal";
import { Section } from "./section";

export function InstallSection() {
  return (
    <Section.Root id="install">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
        <Section.Header>
          <Section.Eyebrow>{m.install_eyebrow()}</Section.Eyebrow>
          <Section.Title>{m.install_title()}</Section.Title>
          <Section.Lead>{m.install_lead()}</Section.Lead>
        </Section.Header>
        <Reveal delay={80} className="min-w-0">
          <Tabs defaultValue="mcp" className="min-w-0 gap-4">
            {/* A full-width segmented control on phones: three targets 44px tall. */}
            <TabsList className="w-full group-data-horizontal/tabs:h-13 sm:w-fit sm:group-data-horizontal/tabs:h-9">
              <TabsTrigger value="mcp" className="px-4">
                {m.install_tab_mcp()}
              </TabsTrigger>
              <TabsTrigger value="skill" className="px-4">
                {m.install_tab_skill()}
              </TabsTrigger>
              <TabsTrigger value="workspace" className="px-4">
                {m.install_tab_workspace()}
              </TabsTrigger>
              <TabsIndicator />
            </TabsList>
            <TabsContent value="skill" className="space-y-3">
              <CodeBlock.Root code={INSTALL_COMMANDS.skill}>
                <CodeBlock.Command />
                <CodeBlock.Copy />
              </CodeBlock.Root>
              <p className="text-sm text-muted-foreground">
                {m.install_skill_note()}
              </p>
            </TabsContent>
            <TabsContent value="workspace" className="space-y-3">
              <CodeBlock.Root code={INSTALL_COMMANDS.workspace}>
                <CodeBlock.Command />
                <CodeBlock.Copy />
              </CodeBlock.Root>
              <p className="text-sm text-muted-foreground">
                {m.install_workspace_note()}
              </p>
            </TabsContent>
            <TabsContent value="mcp" className="space-y-3">
              <CodeBlock.Root code={INSTALL_COMMANDS.mcp}>
                <CodeBlock.Command />
                <CodeBlock.Copy />
              </CodeBlock.Root>
              <p className="text-sm text-muted-foreground">
                {m.install_mcp_note()}
              </p>
              <CodeBlock.Root code={INSTALL_COMMANDS.mcpConfig}>
                <CodeBlock.Snippet />
                <CodeBlock.Copy />
              </CodeBlock.Root>
            </TabsContent>
          </Tabs>
        </Reveal>
      </div>
    </Section.Root>
  );
}
