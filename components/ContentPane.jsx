/**
 * The opaque pane the content sits on, floating over the fixed backdrop.
 *
 * The page itself scrolls — this is not a nested scroll container. That keeps
 * ScrollIndicator's IntersectionObserver on the default viewport root, which
 * is both simpler and better behaved on mobile than a scrolling div.
 */
export default function ContentPane({ children }) {
  return (
    <main
      data-testid="content-pane"
      className="px-4 pb-24 pt-20 md:pl-rail md:pr-8 md:pt-16"
    >
      <div
        className={[
          "mx-auto max-w-pane rounded-[var(--pane-radius)] bg-[var(--pane-bg)]",
          "px-6 py-12 shadow-2xl shadow-black/30 backdrop-blur-[var(--pane-blur)]",
          "sm:px-10 md:px-16 md:py-20",
        ].join(" ")}
      >
        <div className="mx-auto max-w-prose space-y-16 md:space-y-24">
          {children}
        </div>
      </div>
    </main>
  );
}
