import Rail from "@/components/Rail";
import ContentPane from "@/components/ContentPane";
import Intro from "@/components/sections/Intro";
import Projects from "@/components/sections/Projects";
import StuffILearned from "@/components/sections/StuffILearned";
import TrainOfThought from "@/components/sections/TrainOfThought";
import Contact from "@/components/sections/Contact";

/**
 * Section order here is the order on the page and, because ScrollIndicator
 * discovers sections from the DOM, the order in the scroll navigation too.
 * Reordering these lines is the whole operation.
 */
export default function Home() {
  return (
    <>
      <Rail currentId="home" />
      <ContentPane>
        <Intro />
        <Projects />
        <StuffILearned />
        <TrainOfThought />
        <Contact />
      </ContentPane>
    </>
  );
}
