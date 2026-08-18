import Section from "@/components/Section";
import { getMarkdown } from "@/lib/content";

export default function TrainOfThought() {
  // Trusted content — authored in content/thoughts.md in this repo.
  const html = getMarkdown("thoughts.md");

  return (
    <Section id="thoughts" label="Train of thought">
      <div
        className="prose-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </Section>
  );
}
