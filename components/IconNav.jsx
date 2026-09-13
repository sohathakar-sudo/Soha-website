import Link from "next/link";
import { RAIL_ITEMS } from "@/lib/nav";

/**
 * The icon rail. Every entry is a page that exists — see lib/nav.js.
 *
 * Most entries are emoji in a square; an entry marked `wordmark` is set as a
 * word in Garamond instead, which is how the cafe announces itself.
 */
export default function IconNav({ currentId = "home" }) {
  return (
    <nav aria-label="Sections of the site" data-testid="icon-nav">
      <ul className="flex flex-row items-center gap-1 md:flex-col md:items-start md:gap-1.5">
        {RAIL_ITEMS.map(({ id, icon, label, href, wordmark }) => {
          const isCurrent = id === currentId;

          if (wordmark) {
            return (
              <li key={id}>
                <Link
                  href={href}
                  data-testid={`icon-${id}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={[
                    "flex h-9 items-center rounded px-2 font-garamond text-lg italic tracking-wide transition",
                    "hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60",
                    isCurrent
                      ? "text-rail-active"
                      : "text-rail hover:text-rail-active",
                  ].join(" ")}
                >
                  {label}
                </Link>
              </li>
            );
          }

          return (
            <li key={id}>
              <Link
                href={href}
                data-testid={`icon-${id}`}
                aria-current={isCurrent ? "page" : undefined}
                title={label}
                className={[
                  "flex h-9 w-9 items-center justify-center rounded text-lg transition",
                  "hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/60",
                  isCurrent ? "bg-white/15" : "opacity-70 hover:opacity-100",
                ].join(" ")}
              >
                <span aria-hidden="true">{icon}</span>
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
