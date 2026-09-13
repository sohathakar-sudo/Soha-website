/**
 * The left icon rail.
 *
 * Only pages that actually exist appear here — the rail never advertises a
 * room you can't walk into. To add one: create the route under `app/`, then
 * add an entry with its `href`.
 *
 * An entry with `wordmark: true` renders its label as a small word set in
 * Garamond instead of an emoji — that's the cafe's door.
 */
export const RAIL_ITEMS = [
  { id: "home", icon: "🏠", label: "Home", href: "/" },
  { id: "cafe", label: "Cafe", href: "/cafe", wordmark: true },
];
