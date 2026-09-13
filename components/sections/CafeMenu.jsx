import Section from "@/components/Section";
import CafeCounter from "@/components/CafeCounter";
import { getJson } from "@/lib/content";

export default function CafeMenu() {
  const { menu } = getJson("cafe.json");

  return (
    <Section id="menu" label="Menu" heading="Today's menu">
      <CafeCounter menu={menu} />
    </Section>
  );
}
