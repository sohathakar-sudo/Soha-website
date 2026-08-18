/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      // Every value here maps to a CSS custom property defined in
      // app/globals.css. Visual tweaks — including anything coming back
      // from a Paper export — land in one of those two places, never in a
      // component. See the "Keeping Paper's lane clean" note in the plan.
      colors: {
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        "ink-faint": "var(--color-ink-faint)",
        rail: "var(--color-rail-text)",
        "rail-active": "var(--color-rail-text-active)",
        accent: "var(--color-accent)",
      },
      fontFamily: {
        serif: "var(--font-serif)",
        sans: "var(--font-sans)",
      },
      // Registered under `spacing` rather than `width` so it generates the
      // padding utilities too (`pl-rail`) — the content pane offsets itself
      // by the rail width, and `width` alone only yields `w-rail`.
      spacing: {
        rail: "var(--rail-width)",
      },
      maxWidth: {
        pane: "var(--pane-max-width)",
        prose: "var(--prose-max-width)",
      },
    },
  },
  plugins: [],
};
