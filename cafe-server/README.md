# The café relay

A tiny multiplayer server for `public/cafe/`. It does one thing: pass each
player's position to everyone else in the room, in real time. It runs on
Cloudflare's free tier and costs nothing for a personal site.

It is kept in its own folder on purpose — the game in `public/cafe/` stays a
dependency-free, build-free pile of static files you can drop on any host. This
folder is the one piece that needs deploying, and only once.

---

## What it is

- A **Cloudflare Worker** that accepts WebSocket connections.
- A **Durable Object** (`CafeRoom`) that is the one shared room — it remembers
  who is in the café and forwards everyone's movements.

It never runs the game. Each browser runs its own character (exactly as it does
today) and just broadcasts where it is; the server relays that to the others.

## Deploy it (about 15 minutes, once)

You need [Node.js](https://nodejs.org) 18+.

```bash
cd cafe-server
npm install            # installs wrangler, Cloudflare's deploy tool
npx wrangler login     # opens a browser — approve access to your Cloudflare account
npx wrangler deploy    # uploads the relay
```

- No Cloudflare account yet? Make a free one at
  [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) first. **No
  credit card is needed for the free plan.**
- `npx wrangler deploy` prints a URL like
  `https://cafe-relay.<your-subdomain>.workers.dev`. Copy it.

## Point the game at it

Open `public/cafe/src/config.js`, find the `NET` block, and set `url` to that
address **with `https` changed to `wss`**:

```js
export const NET = {
  url: 'wss://cafe-relay.your-subdomain.workers.dev',
  ...
};
```

Commit and redeploy the site. That's it — the café is now multiplayer. Until
`url` is set, the game runs exactly as before, solo, so nothing breaks in the
meantime.

Confirm the relay is up any time by opening its `https://…workers.dev` address
in a browser: it answers "The café relay is running."

## Staying free

The free Workers plan allows 100,000 Durable Object requests and 13,000 GB-s of
duration per day. This relay is built to sit far under both:

- It uses the **WebSocket Hibernation API**, so an empty café bills **no**
  duration.
- The game **only sends when a player actually moves**, so a room of people
  sitting and working is nearly silent.
- **Outgoing** messages (the relay talking to players) are free; only
  **incoming** ones count, and at a 20:1 ratio.
- The room is **capped at 15 people**.

There is no payment method on a free account, so it cannot run up a bill — if a
limit were ever reached, the socket simply stops serving until the daily reset
at midnight UTC.

## Change the room size

Edit `MAX_PLAYERS` at the top of `src/index.js` (keep it in step with the number
of seats in `public/cafe/data/room.json`), then `npx wrangler deploy` again.

## Local development

`npx wrangler dev` runs the Durable Object on your own machine at
`http://127.0.0.1:8787`. To test the game against it, temporarily set
`NET.url` to `ws://127.0.0.1:8787` and open the café in two browser windows.
