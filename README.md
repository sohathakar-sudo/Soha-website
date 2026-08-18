# Soha's website

A personal site — one scrolling page with a left rail, built with Next.js
and Tailwind.

**To change the words on the site, you don't need any of this.** See
[`content/README.md`](content/README.md) — it's a two-minute loop you can do
from a browser.

---

## Run it on your machine

You need [Node.js](https://nodejs.org) 18 or newer (`node --version` to check).

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. Edits to any file appear immediately — no
restart needed.

### Starting from the bundle

If you have `soha-website-history.bundle` rather than a clone:

```bash
git clone soha-website-history.bundle soha-website
cd soha-website
git checkout claude/website-planning-jgcsvc
npm install
npm run dev
```

The bundle keeps the full commit history. To point it back at GitHub:

```bash
git remote set-url origin https://github.com/sohathakar-sudo/Soha-website.git
git push -u origin claude/website-planning-jgcsvc
```

## Put it online

1. Push the branch to GitHub (above)
2. Go to [vercel.com](https://vercel.com), sign in with GitHub, **Add New →
   Project**, pick this repo
3. Deploy — Next.js is detected automatically, no settings to change

Every push deploys itself after that. That's what makes the edit-on-GitHub
loop work: change a file in `content/`, commit, live in about a minute.

## How it's put together

```
app/            page shell, layout, and all design tokens (globals.css)
components/     the rail, scroll indicator, and one file per section
content/        ← everything you'd want to reword lives here
lib/            content loading, date formatting, the rail's link list
tests/          browser tests
```

Two rules keep this maintainable, and they're worth preserving:

**Words live in `content/`, never in components.** Every string on the page
is loaded from a markdown or JSON file. That's what lets you edit copy from
GitHub without touching code.

**Styling lives in `app/globals.css` and `tailwind.config.js`, never in
components.** Colors, pane opacity and blur, rail width, and the type scale
are all CSS custom properties in one place. Components carry layout classes
only.

Because those two are separate, restyling the site can't disturb your
writing, and rewriting your copy can't disturb the design.

## Adding a section

Wrap it in `<Section>` and drop it into `app/page.jsx`:

```jsx
<Section id="music" label="Music">
  ...
</Section>
```

The scroll indicator finds sections by reading the page, so it picks up the
new one automatically — there's no list to keep in sync. Order on the page
is the order in the navigation.

## Bringing a rail page online

The icons along the rail are placeholders for pages that don't exist yet.
To activate one: create the route under `app/`, then in
[`lib/nav.js`](lib/nav.js) give that entry an `href` and remove `pending`.

## Design changes with Paper

The [Paper](https://paper.design) MCP server runs locally, so this only
works with Claude Code running on your own machine — not in a cloud session.

1. Open your file in Paper Desktop (v0.1+); the MCP server starts on port
   `29979`
2. In this folder: `claude mcp add --transport http paper http://127.0.0.1:29979/mcp`
3. Restart Claude Code and run `/mcp` to confirm it connected

Then point it at `app/globals.css` and `tailwind.config.js` — that's where
every visual decision lives.

## Tests

```bash
npm run build && npx next start --port 3210   # in one terminal
npx playwright test                            # in another
```

The first run needs a browser: `npx playwright install chromium`.

Covers the scroll indicator (position tracking, hover labels, click-to-jump),
the rail, the mobile layout, and that each section renders from its content
file.
