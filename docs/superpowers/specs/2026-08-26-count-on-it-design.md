# count-on-it — Design

**Date:** 2026-08-26
**Status:** Approved

## Purpose

A single-counter app for the author's iPhone. It tracks one count against
one goal. Both numbers are adjustable from the screen. Nothing else.

The app is for personal use on one device. It is not shipped to anyone
else and is not submitted to the App Store.

## Constraints That Shaped This

The development Mac runs macOS 12.7.5 (Monterey) on Intel, with no Xcode
installed. The newest Xcode that runs on Monterey is 14.2, which carries
the iOS 16.2 SDK and cannot deploy to a phone running a newer iOS.
Current App Store submission requires a far newer SDK. A native Swift app
therefore needs a macOS upgrade before any code is written.

A Progressive Web App needs none of that: no Xcode, no macOS upgrade, no
Apple Developer Program fee, and no seven-day sideload expiry. For two
numbers and four buttons, the native route buys nothing the author wants.

## Approach

A hand-written static web app installed to the iPhone home screen via
Safari's "Add to Home Screen". No build step, no package manager, no
dependencies. Editing a file and pushing it deploys the app.

Two alternatives were considered and rejected. A Vite/React build with
`vite-plugin-pwa` adds a dependency tree and a deploy action to a project
of roughly two hundred lines; its ergonomics do not pay for themselves at
this size, and it invites dependency churn in a repo that will be touched
rarely. A plain bookmark with no manifest or service worker is cheaper to
build but permanently worse: Safari's chrome stays visible, the icon is
generic, and the app does not open offline.

## Files

```
index.html              markup, single view
style.css               layout and theme
app.js                  state, rendering, event handlers
manifest.webmanifest    name, icons, standalone display mode
sw.js                   service worker, cache-first
icons/icon-192.png      home screen icon
icons/icon-512.png      home screen icon, larger
```

## Data Model

Two integers:

- `count` — progress so far
- `goal` — the target

Persisted as one JSON object in `localStorage` under a single key. Written
on every change. Read once on load; if the key is absent, unparseable, or
holds anything other than two integers, the app falls back to
`{ count: 0, goal: 10 }` rather than throwing.

Home-screen web apps are exempt from Safari's seven-day script-writable
storage eviction, so state survives between sessions.

## Interface

One view, no navigation, no settings screen. Laid out for one-handed use
with the interactive controls in the lower half of the screen.

- The current count, centered and visually dominant
- A progress indicator toward the goal, plus a `7 / 20` style readout
- Large `−` and `+` controls for the count
- A smaller row for the goal: its value with its own `−` and `+`
- A reset control for the count, behind a confirmation step

Reset is deliberately not a bare single-tap button. An accidental reset
destroys the only thing the app stores. The first tap arms it: the control
relabels itself to ask for confirmation, and a second tap within three
seconds performs the reset. If the three seconds lapse, it disarms itself
and returns to its resting label. Only `count` is reset; `goal` is left
alone.

## Rules

- `count` floors at 0. Decrementing at 0 is a no-op.
- `goal` floors at 1.
- `count` may exceed `goal`. Passing the goal is a success state, not an
  error, and the app keeps counting.

## Offline

The service worker caches all seven files on install and serves them
cache-first. The app opens and works with the phone in airplane mode.

Because the cache is versioned by name, shipping a change requires
bumping the cache version in `sw.js` so the old cache is discarded on
activate. Forgetting this is the most likely cause of "I pushed but the
phone shows the old version".

## Testing

Local development runs against `python3 -m http.server` and is driven in
a desktop browser. The acceptance check is installing the app on the
author's iPhone and using it: increment, decrement, adjust the goal,
force-quit, reopen, and confirm the numbers survived.

No test framework. At this size the framework would be larger than the
program, and the failure modes that matter — the icon, the standalone
launch, the storage surviving a cold start — are only observable on the
phone.

## Deployment

A public GitHub repository named `count-on-it` under the `fhightower`
account, served by GitHub Pages from the root of the `main` branch. The
repo is public because Pages on a private repo requires a paid plan.

There is nothing secret in the app. It holds no credentials and makes no
network requests.

## Out of Scope

Multiple counters. A history log or per-day totals. Sync across devices.
Home screen widgets and Lock Screen Live Activities, which a PWA cannot
provide. Any backend.
