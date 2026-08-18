import Section from "@/components/Section";
import { getMarkdown } from "@/lib/content";

export default function Intro() {
  // Trusted content: this HTML comes from content/intro.md in this repo,
  // authored by the site owner. No user input reaches it.
  const html = getMarkdown("intro.md");

  return (
    <Section id="intro" label="Intro">
      <div
        className="prose-content text-[1.05rem] md:text-lg"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Section>
  );
}
