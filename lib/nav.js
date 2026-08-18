/**
 * The left icon rail.
 *
 * Only `home` exists today. The rest are the pages from the sketch that
 * aren't built yet — they render dimmed and inert so the rail has its real
 * shape from day one. To bring one online: create the route, then give the
 * entry an `href` and drop `pending`.
 */
export const RAIL_ITEMS = [
  { id: "home", icon: "🏠", label: "Home", href: "/" },
  { id: "projects", icon: "🧪", label: "Projects", pending: true },
  { id: "reading", icon: "📚", label: "Books", pending: true },
  { id: "watching", icon: "🎞️", label: "Films & TV", pending: true },
  { id: "listening", icon: "🎧", label: "Sounds", pending: true },
  { id: "places", icon: "🗺️", label: "Places", pending: true },
];
