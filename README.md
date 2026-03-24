# Xiangqi GIF Maker

Static browser app for GitHub Pages.

## Features

- Edit a Xiangqi board from scratch by placing or removing pieces on intersections.
- Switch to play mode and make legal moves directly on the board.
- Toggle the side to move from the board toolbar.
- Import a game from Xiangqi FEN plus ICCS/UCCI coordinate moves such as `h2e2`.
- Step through moves, preview the sequence, or undo the last move.
- Render the position sequence to a GIF in the browser with configurable frame delay and end delay.
- Download the GIF or copy it to the clipboard in supported browsers.

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
