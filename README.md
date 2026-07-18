# 10 Months 💕

A tiny interactive anniversary page for Kaltrina.

1. **The game** — press and hold the bow to draw it back (a power bar fills up), then let go to fire a heart-tipped arrow at the love letter. Release inside the golden "sweet spot" to hit it; missing widens the sweet spot a little each time so it never stays frustrating.
2. **The letter** — opens with a short note and one question: *"Do you still love me?"*. The **No** button dodges away every time it's approached, so only **Yes** can ever actually be pressed.
3. **The finale** — a burst of floating hearts and a closing message.

## Running it

No build step — it's plain HTML/CSS/JS. Open `index.html` directly in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Hosting it

Any static host works (GitHub Pages, Netlify, Vercel, Cloudflare Pages). For GitHub Pages: push this repo and enable Pages on the `main` branch (root).

## Customizing

Everything you'd want to tweak lives in two places:

- `index.html` — the letter text (`.letter-body`) and the finale message (`.finale-body`).
- `script.js` — the arrays `SHORT_MISS`, `OVER_MISS`, and `DODGE_LINES` control the playful feedback lines, and `state.sweetStart` / `state.sweetWidth` control how forgiving the bow game is.
