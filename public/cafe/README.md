# Cat Café

Top-down 2D café prototype. Vanilla JS, ES modules, Canvas 2D, no build step.

## Run locally

The game is plain static files, but ES modules cannot load over `file://`, so it
needs a server. From the repository root:

```
npm run cafe
```

Leave it running, then open http://localhost:8000/cafe/. That server has no
dependencies — it does not need `npm install` and it does not involve Next.
If port 8000 is taken, use `PORT=8001 npm run cafe`.

The site's own dev server works too: `npm run dev`, then
http://localhost:3000/cafe.

## Placeholder art

`tools/make-placeholders.html` regenerates every asset in `assets/` at its exact
shipping size. Open it directly from disk, or serve it (served, it reads the real
`data/room.json` so the furniture matches the room), then use the download
buttons and drop the PNGs into `assets/`.

The placeholders are deliberately abstract — black dots among hollow circles.
Real artwork replaces the PNGs without any code change.

Full deployment and art-swapping notes land in phase 8.
