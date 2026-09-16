# Weather Dashboard — Plan v1

## Goal
A single static HTML page (no server, no build step) that on every open shows two weather
images side by side in a grid, laid out so future additions land in a second row:

- **Left:** the same weather graphic Google shows at the top of search results for "pogoda bydgoszcz"
- **Right:** the meteo.pl meteogram for Bydgoszcz, for *today's* date

## Part 2 (meteo.pl) — straightforward

URL pattern:
```
https://www.meteo.pl/um/metco/mgram_pict.php?ntype=0u&fdate=YYYYMMDD00&row=381&col=199&lang=pl
```

- `row=381&col=199` is the Bydgoszcz grid cell — fixed, never changes.
- `fdate` = today's date as `YYYYMMDD` + literal `00` (based on the example
  `fdate=2026081700` for 2026-08-17). Assumption: the trailing `00` is a fixed run-hour
  (the model's 00 UTC run), not the current hour — please confirm this is right, since I
  can't verify against a second date myself. If meteo.pl actually expects the current hour
  there, the src would need `HH` = current local hour instead of a hardcoded `00`.
- Because there's no server, "today's date" has to be computed **client-side** in the
  browser's timezone using plain JS (`new Date()`), formatted to `YYYYMMDD`, and spliced
  into the `<img src>` on page load.
- `<img>` tags aren't subject to CORS, so hot-linking this directly works fine from a
  static page opened via `file://` or any static host.

This part has no open questions beyond the `00` vs current-hour assumption above.

## Part 1 (Google's weather box) — the actual hard problem

This is the part worth flagging before I build anything, because "the same image Google
shows" doesn't quite exist as a fetchable resource:

- Google's weather panel on the search results page is not a single static image — it's a
  chunk of live-rendered HTML/CSS assembled from Google's own weather data, with no public
  direct image URL.
- The search results page itself cannot be embedded in an `<iframe>` — Google sends
  `X-Frame-Options` / CSP headers that block framing.
- There's no supported Google API that returns "the weather rich-result panel as an image."
- Screen-scraping Google's search HTML from client-side JS won't work either: the request
  would be blocked by CORS (Google doesn't allow cross-origin `fetch` from arbitrary pages),
  and even routing it through a public CORS proxy would mean scraping Google search results
  programmatically, which is against Google's Terms of Service, fragile (the HTML/class
  names change often, region/consent-screen variations, could get your IP rate-limited),
  and isn't really appropriate for me to build.

**Options to choose from for the left tile:**

1. **Recommended: use a real weather API and render our own tile that looks similar.**
   Pull current conditions + short forecast for Bydgoffszcz from a free, key-less,
   CORS-friendly API (e.g. Open-Meteo) and render a small widget (icon, temperature,
   description, maybe hi/lo) in a similar style/layout to Google's box. Fully static,
   reliable, no scraping, updates live every time you open the page.
2. **Static screenshot, manually refreshed.** You periodically save a screenshot of
   Google's weather box yourself and drop it in the project folder; the page just displays
   that image file. Truly "the same image," but not live — it'll go stale until you
   re-save it.
3. **Link out instead of embedding.** Left tile is a clickable card/button that opens
   `https://www.google.com/search?q=pogoda+bydgoszcz` in a new tab. Always accurate,
   zero maintenance, but you have to click through rather than see it inline.
4. **Best-effort scraping via a public CORS proxy.** Attempt to fetch and parse the
   weather box out of Google's search HTML client-side. Flagging this as an option only
   for completeness — I'd advise against it for the ToS/reliability reasons above, and
   would only build it if you explicitly want that traded off.

I'd go with **option 1** unless you have a reason to prefer another — it's the only one
that's both live and doesn't rely on scraping Google.

## Layout

CSS grid, 2 columns on the first row, wrapping to a new row as more tiles are added:

```
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 1rem;
}
```

- Tile 1 (left): weather widget per the chosen option above
- Tile 2 (right): meteo.pl `<img>`
- Each tile is a `.card` with a title, so adding a 3rd/4th source later is just another
  `.card` div — no layout changes needed.

## Files

- `index.html` — structure only (two/more `.card` divs inside `.grid`)
- `style.css` — grid layout + card styling
- `script.js` — computes today's date, builds the meteo.pl `<img src>`, and (if option 1)
  fetches Open-Meteo data and renders the left tile

No build tooling, no dependencies, no server — open `index.html` directly or serve the
folder with any static file server.

## Open questions for you before I implement

1. Which option (1–4 above) do you want for the Google/left tile?
2. Confirm: is meteo.pl's trailing `00` in `fdate` really fixed, or should it track the
   current hour?
3. Any preference on visual style (plain/minimal vs. something closer to Google's actual
   card look), or is basic/clean enough?
