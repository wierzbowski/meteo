# Meteo project — reference summary

Read this to get oriented in a fresh session. It describes what the project *is*,
not a step-by-step history — see `260817_meteo_v1_plan.md` in this same folder for
the original planning doc, and `git log --oneline` for the change-by-change history.

## What this is

A single static weather dashboard for Bydgoszcz — `index.html` + `style.css` +
`script.js`, no server, no build step, no dependencies. Open `index.html` directly
(`file://`) or serve the folder with any static file server. Everything is fetched
client-side from public, key-less APIs/image endpoints at page load.

## Layout

CSS grid, two columns (`minmax(280px, 2fr) minmax(280px, 3fr)`), collapsing to one
column under 640px:

- **Row 1** (`#owm-card`, spans the full width): current conditions, a 60-hour
  precipitation chart, and an 8-day forecast strip.
- **Row 2, left (2fr):** meteo.pl meteogram image.
- **Row 2, right (3fr):** DWD synoptic surface chart (via FU Berlin).

The row-1 card was widened to full-width and the meteo.pl/DWD split was tuned to
2:3 because the meteogram's intrinsic image width doesn't need as much room as the
DWD map.

## Data sources & the non-obvious parts of each

### Open-Meteo (`api.open-meteo.com/v1/forecast`) — current + hourly + daily
No auth, CORS-enabled, one request per load in `loadCurrentWeather()`. Powers:
current conditions, the precipitation chart, and the 8-day strip (`forecast_days=8`
= today + 7 days, matching Google's weather widget). Weather codes are WMO codes,
mapped to a Polish description + emoji icon in `WEATHER_CODES`/`describeCode()`.

### meteo.pl meteogram (`setMeteoImage()`)
URL needs `fdate=YYYYMMDDHH`. DWD-style models here run 4x/day (00/06/12/18), but a
run isn't published immediately — an unpublished `fdate` silently returns **HTTP 200
with a tiny 10×130px placeholder GIF**, not an error, so `onerror` never fires.
The fix: after `img.onload`, check `img.naturalWidth < 100` — if it's the
placeholder, step back 6 hours (`previousMeteoRun`) and retry, up to 6 attempts.
The heading shows whatever run actually ends up displayed (`meteo-run-label`), set
right before each attempt's `img.src` so it always matches what's on screen.

### DWD synoptic map (`setDwdImage()`)
Fetched from `wind.met.fu-berlin.de/storage/wetterkarten/gme_tkb_na_p_036_000.gif`
— fixed lead time (+36h forecast; the site also offers +48/+60/+84/+108h and a
`ana_bwk_na_p_000_000.gif` current analysis, unused here). **This URL has no
date/run encoded in it at all** — FU Berlin overwrites the same file in place once
a day, from what looks like a single daily run: near-term charts (analysis, +36h)
land ~07:10 UTC, the longer-range ones (+48h and beyond) land a few hours later
(~12:30 UTC observed). There's no `Access-Control-Allow-Origin` on that host, so
client-side JS can't read the real `Last-Modified` header — that's why the caption
is a static "updated once daily" note instead of a live timestamp. A cache-bust
query param (current date+hour) is appended so the browser doesn't keep serving a
stale copy of that unchanging URL across days.

## The precipitation chart (`renderPrecipChart`)

A single chart encodes three things per hour, all in one bar:
- **Height** = precipitation probability (%).
- **Width** (3–12px, `precipBarWidthPx`) = precipitation amount in mm, scaled
  against a 2mm/h ceiling (anything at/above that gets the widest bar).
- **Column background** = night shading, computed from that day's `sunrise`/
  `sunset` (`buildSunWindows`/`isNight`) — matches the shaded band meteo.pl's own
  meteogram shows.

A day-name row (`precip-days`, Pon/Wt/Śr…) sits above the bars, aligned to each
day's 12:00 column using the *same* flex-column structure as the bars/hour-label
rows — that's what keeps it pixel-aligned without manual offset math.

The window is 60 hours, starting at "now" floored to the nearest **4-hour**
boundary (so e.g. 15:16 → starts at 12:00) — that boundary matches the 4-hour grid
the hour labels are already drawn on (`i % 4 === 0`).

Accessibility: every bar has a `role="img"` + `aria-label` with the full value,
keyboard-focusable, plus a hidden (`sr-only`) `<table>` mirroring the same data —
tooltips/visuals never gate information that isn't also in the DOM.

## Known constraints / things not to "fix"

- No PL diacritics anywhere in UI strings or code comments (`Ladowanie`, not
  `Ładowanie`) — intentional, kept consistent throughout rather than fixed halfway.
- The favicon (`favicon.svg`) is a hand-drawn sun-behind-cloud SVG, referenced via
  `<link rel="icon" type="image/svg+xml">`.
- This is a personal single-page tool — no build step, no framework, no tests.
  Verification so far has been manual: temporary local static server +
  claude-in-chrome screenshots, torn down after each check.
