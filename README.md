# Board Game GIF Maker

Static browser app for GitHub Pages.

Live page: https://bluemoon012905.github.io/weiqi-chess-shogi-Xiangqi-gif-maker/
## Features

- Xiangqi editor and playback with FEN plus ICCS/UCCI import.
- Chess editor and PGN branch export workflow.
- Weiqi / Go editor and SGF branch export workflow.
- Shogi editor with SFEN/USI import, variant presets, and GIF export.
- Render position sequences to GIFs in the browser with configurable timing.
- Download the GIF or copy it to the clipboard in supported browsers.

## Project structure

```text
src/
  app.js
  core/
    shared.js
  games/
    chess/
      index.js
    go/
      index.js
    shogi/
      index.js
    xiangqi/
      index.js
```

Each game now lives in its own folder and only depends on `src/core/shared.js` for generic UI/render helpers.

## Run locally

Serve the directory with any static server, for example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Using a static server is recommended because the app loads local GIF encoder assets:

- `vendor-gif.js`
- `vendor-gif.worker.js`

## Deploy to GitHub Pages

Push these files to a GitHub repository and enable GitHub Pages for the branch. The app is fully static and ships its GIF encoder locally, so it does not need a backend.

## Usage Notes

- The editor palette defaults to remove mode.
- The `Moves` field reflects the current move list while you play, import, or undo.
- Board coordinates are shown on the top and left sides only.
- Clipboard GIF copy depends on browser support for writing `image/gif` to the clipboard.

## Import format

- FEN example:
  `rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR`
- Side to move:
  `w` for red, `b` for black
- Move format:
  ICCS/UCCI coordinates like `h2e2 h9g7 e2e7`
