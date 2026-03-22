# Baseball Scorebook (Paper-Style Web App)

A lightweight client-side baseball scorekeeping app designed to feel like a traditional paper score pad/book.

## Features

- Paper-style scorebook table with:
  - lineup rows
  - inning-by-inning entry boxes (1–9)
  - manual total boxes (AB, R, H, RBI)
- Add/remove players and maintain lineup order
- Quick score controls for Home/Away runs and inning number
- Optional plate appearance logging with automatic batting stats:
  - AB, H, BB, TB, AVG, OBP, SLG, OPS
- Local persistence with `localStorage`

## Run locally

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit <http://localhost:8080>.

## Vision

This starter intentionally mirrors the look and flow of a physical scorebook while remaining easy to extend into full official scoring notation support.
