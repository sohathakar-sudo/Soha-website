import Link from "next/link";
import { RAIL_ITEMS } from "@/lib/nav";

/**
 * The icon rail. Live entries link to real routes; entries still marked
 * `pending` in lib/nav.js render dimmed and non-interactive, so the rail
 * shows its eventual shape without pretending the pages exist yet.
 */
export default function IconNav({ currentId = "home" }) {
  return (
    <nav aria-label="Sections of the site" data-testid="icon-nav">
      <ul className="flex flex-row gap-1 md:flex-col md:gap-1.5">
        {RAIL_ITEMS.map(({ id, icon, label, href, pending }) => {
          if (pending) {
            return (
              <li key={id}>
                <span
                  data-testid={`icon-${id}`}
                  aria-disabled="true"
                  title={`${label} — not built yet`}
                  className="flex h-9 w-9 cursor-default select-none items-center justify-center rounded text-lg opacity-25 grayscale"
                >
                  <span aria-hidden="true">{icon}</span>
                  <span className="sr-only">{label} (not built yet)</span>
                </span>
              </li>
            );
          }

          const isCurrent = id === currentId;
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
