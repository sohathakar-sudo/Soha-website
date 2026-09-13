import Section from "@/components/Section";
import { getJson } from "@/lib/content";

export default function CafeHouseRules() {
  const { houseRules } = getJson("cafe.json");

  return (
    <Section id="rules" label="House rules" heading="House rules">
      <ul className="space-y-3">
        {houseRules.map((rule) => (
          <li
            key={rule}
            className="flex gap-3 text-[1.05rem] leading-relaxed text-ink"
          >
            <span aria-hidden="true" className="text-ink-faint">
              —
            </span>
            <span>{rule}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
