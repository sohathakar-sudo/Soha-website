import Section from "@/components/Section";
import RelativeTime from "@/components/RelativeTime";
import { getJson, sortByDateDesc } from "@/lib/content";

export default function StuffILearned() {
  const entries = sortByDateDesc(getJson("learnings.json"));
  const newest = entries[0]?.date;

  return (
    <Section
      id="learned"
      label="Stuff I learned"
      heading="Documenting my learnings"
    >
      {newest ? (
        <p className="mb-5 font-sans text-xs text-ink-faint">
          Last updated <RelativeTime date={newest} />
        </p>
      ) : null}

      <ul className="space-y-4">
        {entries.map((entry, i) => {
          const linked = Boolean(entry.href);
          const Title = linked ? "a" : "span";

          return (
            <li key={entry.title ?? i}>
              <div className="flex items-baseline justify-between gap-4">
                <Title
                  {...(linked
                    ? {
                        href: entry.href,
                        target: "_blank",
                        rel: "noreferrer noopener",
                      }
                    : {})}
                  className={[
                    "text-[1.02rem] leading-snug",
                    linked
                      ? "text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                      : "text-ink",
                  ].join(" ")}
                >
                  {entry.title}
                </Title>
                <RelativeTime
                  date={entry.date}
                  className="shrink-0 font-sans text-xs tabular-nums text-ink-faint"
                />
              </div>
              {entry.note ? (
                <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">
                  {entry.note}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
