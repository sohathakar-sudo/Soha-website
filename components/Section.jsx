/**
 * Wrapper every section on the page uses.
 *
 * The `data-section` / `data-label` pair is what ScrollIndicator discovers at
 * runtime — wrapping a new section in this component is all it takes to get
 * it into the scroll navigation.
 */
export default function Section({ id, label, heading, children }) {
  return (
    <section
      id={id}
      data-section
      data-label={label}
      className="scroll-mt-24 md:scroll-mt-16"
    >
      {heading ? (
        <h2 className="mb-5 font-sans text-[0.7rem] uppercase tracking-[0.2em] text-ink-faint">
          {heading}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
