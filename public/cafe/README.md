# Cat Café

Top-down 2D café prototype. Vanilla JS, ES modules, Canvas 2D, no build step.

## Run locally

Serve the project root with any static file server and open `cafe/`:

```
npx serve .        # or: python3 -m http.server
```

ES modules need HTTP — opening `index.html` from the filesystem will not work.

In this repository the game lives at `public/cafe/`, so `npm run dev` serves it at
http://localhost:3000/cafe/.

Full deployment and art-swapping notes land in phase 8.
