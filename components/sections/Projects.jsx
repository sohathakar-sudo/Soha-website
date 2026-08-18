import Section from "@/components/Section";
import { getJson } from "@/lib/content";

function Thumbnail({ src, alt }) {
  if (!src) {
    return (
      <div
        aria-hidden="true"
        className="h-12 w-12 shrink-0 rounded-sm border border-ink-faint/30 bg-ink-faint/10"
      />
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-sm border border-ink-faint/30 object-cover"
    />
  );
}

export default function Projects() {
  const projects = getJson("projects.json");

  return (
    <Section id="projects" label="Projects" heading="Extremely fun projects">
      <ul className="space-y-5">
        {projects.map((project, i) => {
          // "#" is the placeholder href in the starter content — treat it the
          // same as null so an unlinked project doesn't render a dead link.
          const linked = project.href && project.href !== "#";
          const Title = linked ? "a" : "span";

          return (
            <li key={project.name ?? i} className="flex items-start gap-4">
              <Thumbnail src={project.thumbnail} alt={project.name} />
              <div className="min-w-0">
                <Title
                  {...(linked
                    ? {
                        href: project.href,
                        target: "_blank",
                        rel: "noreferrer noopener",
                      }
                    : {})}
                  className={[
                    "block text-[1.05rem] leading-snug",
                    linked
                      ? "text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
                      : "text-ink",
                  ].join(" ")}
                >
                  {project.name}
                </Title>
                {project.description ? (
                  <p className="mt-1 text-[0.95rem] leading-relaxed text-ink-soft">
                    {project.description}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
