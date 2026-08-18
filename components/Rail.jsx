import IconNav from "@/components/IconNav";
import ScrollIndicator from "@/components/ScrollIndicator";

/**
 * Left sidebar: icon rail on top, scroll-position indicator below.
 *
 * Fixed on desktop. Below `md` it becomes a horizontal bar pinned to the top
 * — the scroll indicator is hidden there, since a narrow screen has no room
 * for it and the page is short enough to thumb through.
 */
export default function Rail({ currentId }) {
  return (
    <div
      data-testid="rail"
      className={[
        "fixed inset-x-0 top-0 z-20 flex items-center gap-4 border-b border-white/10",
        "bg-black/40 px-4 py-2 backdrop-blur-sm",
        "md:inset-x-auto md:bottom-0 md:left-0 md:w-rail md:flex-col md:items-stretch",
        "md:gap-8 md:overflow-y-auto md:border-b-0 md:bg-transparent md:px-6 md:py-8 md:backdrop-blur-none",
      ].join(" ")}
    >
      <IconNav currentId={currentId} />
      <div className="hidden md:block">
        <ScrollIndicator />
      </div>
    </div>
  );
}
