import Section from "@/components/Section";
import { getJson } from "@/lib/content";

export default function Contact() {
  const { note, email, links = [] } = getJson("contact.json");

  return (
    <Section id="contact" label="Say hi">
      {note ? (
        <div className="mb-8 max-w-sm -rotate-1 bg-[#f4e9a8] p-5 shadow-md shadow-black/10">
          <p className="font-sans text-[0.95rem] leading-relaxed text-ink">
            {note}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        {email ? (
          <p className="text-[1.05rem]">
            <a
              href={`mailto:${email}`}
              className="text-accent underline decoration-accent/40 underline-offset-4 hover:decoration-accent"
            >
              {email}
            </a>
          </p>
        ) : null}

        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-sans text-sm text-ink-soft underline decoration-ink-faint underline-offset-4 hover:text-ink"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}
