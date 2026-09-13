import Section from "@/components/Section";
import { getJson } from "@/lib/content";

export default function CafeAmbience() {
  const { nowPlaying } = getJson("cafe.json");

  return (
    <Section id="ambience" label="Ambience" heading="Playing in the room">
      <p className="font-garamond text-[1.2rem] italic leading-relaxed text-ink-soft">
        {nowPlaying}
      </p>
    </Section>
  );
}
