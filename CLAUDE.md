# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running

No install, no build, no bundler. Four files served as-is.

```bash
start index.html              # Windows, opens in default browser
python -m http.server 8000    # or serve statically, then http://localhost:8000
npx serve .
```

There are no tests and no linter. Verification is manual: open the game, play it, and check the browser console for errors.

## Architecture

All game logic lives in `game.js` (~300 lines, no modules, no exports). `index.html` provides the DOM, `style.css` the dark arcade theme.

**The piece type index does triple duty.** A number 1–7 is simultaneously the index into `PIECES` (`game.js:18`), the index into `COLORS` (`game.js:7`), and the value stored in a settled board cell. `0` means empty. This is why `PIECES[0]` and `COLORS[0]` are both `null` — index 0 is reserved for "no piece". Any change to one array must keep the other aligned.

**State is module-level mutable globals** declared on `game.js:43` (`board`, `current`, `next`, `score`, `paused`, `animId`, …). `init()` (`game.js:259`) is the single reset point and is wired both to page load (`game.js:304`) and to the restart button (`game.js:302`) — new state must be reset there or it leaks across games.

**DOM ids are the contract between `index.html` and `game.js`.** Element lookups run at load time (`game.js:31-41`), not lazily, and `game.js` is a plain `<script>` at the end of `<body>` with no `defer`. Renaming or removing an id in `index.html` yields a null reference the moment the script runs.

**Game loop** is `requestAnimationFrame` with a time accumulator (`loop`, `game.js:243`): `dropAccum` grows by `dt` and drops the piece one row when it exceeds `dropInterval`. The frame id is kept in `animId`. Pause and game over call `cancelAnimationFrame(animId)`; resuming must reset `lastTime = performance.now()` before re-entering `loop` (`game.js:232-234`) — skipping that reset produces a `dt` equal to the whole pause duration and instantly drops the piece.

**Rotation** is transpose-and-reverse (`rotateCW`) followed by wall kicks (`tryRotate`, `game.js:77`): the rotated shape is tried at offsets `[0, -1, 1, -2, 2]` and the rotation is silently discarded if none fit. This is not SRS — there are no per-piece kick tables.

## Constraints when editing

- Changing `COLS`, `ROWS`, or `BLOCK` (`game.js:3-5`) requires updating `width`/`height` on `<canvas id="board">` (`index.html:12`) to `COLS × BLOCK` and `ROWS × BLOCK`. Canvas attributes are the drawing surface size; they are not derived from JS.
- `drawNext()` (`game.js:210`) hardcodes a 30px block and centers the shape in a fixed 4×4 area, matching `<canvas id="next-canvas" width="120" height="120">` (`index.html:30`). Pieces larger than 4×4 will overflow the preview.
- Adding a piece means extending `PIECES`, extending `COLORS`, **and** widening the `Math.random() * 7` bound in `randomPiece()` (`game.js:50`) — that literal is not derived from the array length.
- Piece spawn uses `y: 0` with no vertex buffer above the board; `collide` (`game.js:55`) tolerates negative `ny` for that reason, so keep that guard if spawn changes.

## Conventions

- User-facing text is Spanish (`PAUSA`, `GAME OVER`, `Puntuación`, `Reiniciar`); code identifiers and comments are English. Keep this split.
- `'use strict'`, browser-native ES6+ only. Zero dependencies is deliberate — do not add a `package.json`, bundler, or framework unless explicitly asked.
- `README.md` is Spanish and documents mechanics, controls, scoring, and tunable constants in detail. Update it when gameplay behavior changes.
