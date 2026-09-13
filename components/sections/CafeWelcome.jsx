import Section from "@/components/Section";
import { getMarkdown } from "@/lib/content";

export default function CafeWelcome() {
  // Trusted content: this HTML comes from content/cafe.md in this repo,
  // authored by the site owner. No user input reaches it.
  const html = getMarkdown("cafe.md");

  return (
    <Section id="welcome" label="Welcome">
      <h1 className="mb-6 font-garamond text-4xl italic tracking-wide text-ink md:text-5xl">
        Cafe
      </h1>
      <div
        className="prose-content text-[1.05rem] md:text-lg"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Section>
  );
}
