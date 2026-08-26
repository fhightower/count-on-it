# count-on-it

One count, one goal. A single-screen PWA for iPhone.

Add it to the home screen from Safari and it opens full-screen, works
offline, and remembers where you were.

## Local development

```
python3 -m http.server 8777
```

Then open <http://127.0.0.1:8777>.

## Deploying

GitHub Pages serves the root of `main`. Push and it's live.

**Bump `CACHE` in `sw.js` on every deploy.** The service worker is
cache-first, so without a new cache name the phone keeps serving the
previous build.
