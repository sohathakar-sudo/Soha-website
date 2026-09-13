import Rail from "@/components/Rail";
import ContentPane from "@/components/ContentPane";
import CafeWelcome from "@/components/sections/CafeWelcome";
import CafeMenu from "@/components/sections/CafeMenu";
import CafeHouseRules from "@/components/sections/CafeHouseRules";
import CafeAmbience from "@/components/sections/CafeAmbience";

export const metadata = {
  title: "Cafe — Soha Thakar",
  description: "A quiet corner to work in.",
};

/**
 * The work cafe. Same shell as the home page — rail, pane, sections — on
 * warmer paper (the `cafe` class, see app/globals.css).
 */
export default function Cafe() {
  return (
    <div className="cafe">
      <Rail currentId="cafe" />
      <ContentPane>
        <CafeWelcome />
        <CafeMenu />
        <CafeHouseRules />
        <CafeAmbience />
      </ContentPane>
    </div>
  );
}
