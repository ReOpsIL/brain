# Brain Spark — build plan and handoff

A macOS menu bar brain-puzzle game for adults 55+. Click the icon near the clock and a game
panel drops down, the same idea as `~/develop/move` (Chess Move). Thousands of puzzles,
graphically rich, fully interactive.

**Status: built.** All 11 puzzles, the screens, the Swift shell, the build script, the icon and the tests exist.
The rest of this file is the spec they were built from; keep it in step with the code when either changes.

## What is where

| Path | What |
| --- | --- |
| `Resources/web/index.html`, `css/app.css` | The page and all styling (one section per screen and per game) |
| `Resources/web/js/engine.js` | Seeded RNG (`BS.rng`), hash, game registry (`BS.game`), level bands, `BS.puzzle(id, level, salt)`, hyperscript helper `BS.h` |
| `Resources/web/js/words.js` | Generated word data: 600 five-letter answers, 5,055 valid guesses, 5×300 scramble words (with anagram alternatives), 30 word-search themes |
| `Resources/web/js/games/*.js` | The 11 puzzles, one file each (`gen` + `mount`) |
| `Resources/web/js/app.js` | Screens (home, lobby, play, settings), saved state, sounds, confetti, the native bridge |
| `Resources/web/fonts/` | Fraunces (variable) and Atkinson Hyperlegible 400/700, latin woff2, both OFL |
| `Sources/BrainSpark/` | Menu bar shell: `main.swift`, `AppDelegate.swift` (status item, bridge, saved state), `GamePanel.swift` |
| `scripts/build_app.sh`, `scripts/make_icon.swift` | Builds `build/Brain Spark.app`; `--install` copies it to /Applications and opens it |
| `scripts/make_dmg.sh` | Builds the app and packages it as `build/BrainSpark-<version>.dmg` |
| `tools/test_puzzles.js` | Generates and checks every level of every game under Node |
| `tools/build_words.js` | Regenerates `words.js` (`npm install wordlist-english && node tools/build_words.js`) |

Not yet checked by hand in the installed app (see Testing): typing in Word Guess, dragging by the header,
and the three sizes on a small screen.

Differences from the original plan, all small:

- Saved state has two extra keys: `daily.lv` (the level each of today's five was dealt at, so it stays the same
  all day) and `seen` (games whose how-to has been shown once).
- Leaving a puzzle keeps it in memory, so going back to the same level carries on where you left off (until the app quits).
- The home screen is sized to fit without scrolling.
- The shell has two debugging flags: `--js "<script>"` runs a script after the game loads and
  `--snapshot out.png` saves a picture of the web view and quits (it never writes saved state).

## Architecture

Thin native shell + web game, so the game can be tested in any browser and the Swift part stays small.

- **Swift package** (model it on `~/develop/move`: `Package.swift`, `Sources/BrainSpark/{main,AppDelegate,GamePanel}.swift`,
  `scripts/build_app.sh [--install]`, `LSUIElement` app, ad-hoc signed, category `public.app-category.education`
  so macOS doesn't turn on Game Mode).
  - `NSStatusItem` (SF Symbol `puzzlepiece.extension.fill`, template). Left click toggles the panel,
    right click shows a menu (Open, Today's five, Move Back Under Icon, Open at Login, Quit).
  - Borderless `NSPanel` like `PuzzlePanel` in move (`.nonactivatingPanel`, `level = .statusBar`,
    `canBecomeKey = true`, placed under the icon, remembered position when dragged).
  - `WKWebView` filling the panel, loading `Resources/web/index.html` via `loadFileURL(_:allowingReadAccessTo:)`.
    Rounded corners: put the web view in a layer-backed container with `cornerRadius` + `masksToBounds`;
    `webView.setValue(false, forKey: "drawsBackground")`. Subclass to return `true` from `acceptsFirstMouse`.
  - Bridge: `window.webkit.messageHandlers.bs.postMessage({type, ...})` with types
    `save` (state JSON string → `~/Library/Application Support/BrainSpark/state.json`), `close`, `quit`,
    `dragStart` / `drag` / `dragEnd` (move the panel using `NSEvent.mouseLocation`, as move's `handleMove` does),
    `scale` (set `webView.pageZoom` and resize the panel, clamped to the screen), `loginItem` (`SMAppService.mainApp`).
  - Saved state is injected at document start with a `WKUserScript`:
    `window.BS_NATIVE = {state: <json or null>, login: <bool>, version: "1.0.0"}` (validate the JSON first).
    Don't rely on `localStorage` in the app; keep it only as the fallback when running in a plain browser.
  - On show call `BS.onShow()`; menu "Today's five" calls `BS.openDaily()`. Show the panel automatically on first launch.
  - Base panel size 480×700 pt; size setting scales it 1.0 / 1.15 / 1.3.
- **Web game** in `Resources/web/`: `index.html`, `css/app.css`, `js/engine.js`, `js/words.js`,
  `js/games/*.js`, `js/app.js` (load in that order). No network, no build step.

## Game module contract

```js
BS.game({
  id, name, cat,            // cat: 'Words' | 'Logic' | 'Memory' | 'Numbers' | 'Visual'
  color, icon,              // enamel accent + inline SVG
  tagline, how: [..],       // plain-language how-to steps
  gen(level, rng, salt),    // pure, no DOM. Returns the puzzle (may include `allow`: mistakes per lost star)
  mount(root, puzzle, ctx)  // builds the board. Returns {hint(), key(e)?, destroy()?}
});
// ctx: win({stars}?), fail(message), mistake(), hintUsed(), sfx(name), status(text), progress(i, n), settings
```

- 500 levels per game × 11 games = 5,500 numbered puzzles. Level N is always the same puzzle (seed = hash(id:level)).
- Bands of 100: Gentle, Easy, Medium, Tricky, Expert (`BS.band`, `BS.frac`). No locked levels; "Continue" goes to the first unsolved.
- Stars: `max(1, 3 − hints − floor(mistakes / allow))`. Never time-based. No timers anywhere.
- **Today's five**: one game per category, chosen by date seed, at the player's current level in that game,
  with `salt = 'd' + date` so it differs from the numbered level. Finishing all five extends the day streak.

## The 11 puzzles

| id | Category | Rules and difficulty curve |
| --- | --- | --- |
| `sudoku` | Logic | Band 0 is 6×6 (2×3 boxes, 26→18 clues); bands 1–4 are 9×9 (44→27 clues). Generate a full grid by seeded backtracking, dig cells while a count-to-2 MRV solver confirms a unique solution. Notes, undo, erase, digit pad with remaining counts, peer and same-digit highlighting, optional "show mistakes as I go". Hint fills a cell. |
| `pipes` | Logic | "Light every lamp": random spanning tree on the grid (growing-tree, not pure DFS), tiles randomly rotated; tap rotates clockwise, right-click counter-clockwise. Tiles connected to the source glow. Win = all lit and every connection reciprocated (don't compare to the stored solution). 4×4 → 6×7. Hint locks a tile in its correct rotation. |
| `wordsearch` | Words | 8×8 → 12×12, 5 → 12 words from one theme. Band 0 right/down only, then diagonals, then all 8 directions. Drag to select, or click the first and last letter. Highlighter capsules in an SVG overlay. Hint pulses a first letter. |
| `scramble` | Words | 3 words per level from `BS.words.scramble[band]` (4–5 letters up to 8–9). Numbered levels index the pool sequentially so words don't repeat; salted puzzles pick by rng. Accept any listed alternative anagram. Tap tiles or type; Shuffle and Clear. First letter is given in bands 3–4. Hint places the next letter. |
| `wordguess` | Words | Five letters, six tries, on-screen and physical keyboard, guesses checked against `valid5`. Mark results with shape as well as color. Stars: ≤4 tries = 3, 5 = 2, 6 = 1. Missing all six calls `ctx.fail("The word was …")`. Hint reveals one letter position. |
| `pairs` | Memory | Flip cards to find pairs; emoji faces (Apple Color Emoji looks great). 4×3 → 5×6 cards; later levels use look-alike sets. Short preview in band 0. `allow` = number of pairs. Hint peeks at everything briefly. |
| `recall` | Memory | A pattern of k cells lights up on an n×n grid, then the player taps it back. 3 rounds. n 3→6, k 3→13. Each round starts on a "Ready" button so nothing surprises the player. Hint shows the pattern again. |
| `sequence` | Numbers | 5 questions, 4 large answer buttons, the rule is explained after each answer. Rules by band: +k/−k → ×2, alternating steps → growing differences, squares, interleaved → Fibonacci-style, triangular, primes → cubes, second-order differences. Hint removes a wrong option. `allow` 2. |
| `sums` | Numbers | "Pick 3 numbers that add up to 24": 6–12 number bubbles, pick 2–5. Any subset of the right size and sum is accepted. 5 rounds, running total shown. Hint points to a bubble from a valid solution. `allow` 2. |
| `odd` | Visual | A grid of identical asymmetric shapes with one different (rotation, mirror, size, tone, missing detail). 3×3 → 6×6, differences get subtler; in later bands the others are randomly turned and the odd one is mirrored. Use lightness, not hue, for tone differences. 5 rounds. Hint dims half the wrong cells. |
| `slide` | Visual | Sliding tiles, 3×3 (bands 0–1) and 4×4 (bands 2–4), scrambled by a random walk from solved so it is always solvable. Keep a path-to-solved stack (scramble moves + player moves, popping on an inverse) so Hint can always play the next move back. Click a tile in the blank's row/column to slide several. |

## Design direction

Audience first: 55+, so body text ≥17 px, hit targets ≥44 px, strong contrast, calm pacing, no flashing, forgiving
(hints, undo, no penalties for time), `prefers-reduced-motion` respected, keyboard focus visible.

Concept: **the game table**. A felt tabletop with ivory tiles, playing cards and brass details, like the
card table and tile games the audience grew up with. Puzzle content is always dark ink on an ivory tile,
which is also the most readable combination.

- Felt (background) `#0F3B36` → `#134A43` with a soft highlight and faint noise; alternative table colors
  as a setting (midnight blue, burgundy).
- Ivory tile `#F6EEDC` with a darker bottom edge `#D9CBAA` for depth; ink `#1E2A28`.
- Brass `#E2B04A` for stars, focus and the primary button.
- Enamel accents, one per category: berry `#C2416B`, cobalt `#2F6FD0`, marigold `#F0A92B`, jade `#2FA37A`, plum `#7A55C7`.
- Type: Fraunces for titles, Atkinson Hyperlegible (made for low-vision readers) for everything else and for tiles.
- Avoid: all-caps eyebrow labels, "A · B · C" meta strings, arrows on buttons, identical rounded cards everywhere.

Screens (480×700):

```
Home                          Game lobby                    Play
┌───────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────┐
│ ✦ Brain Spark   3 days ⚙ ×│ │ ‹  Sudoku                 │ │ ‹ Sudoku       ● ● ○  Hint ?│
│ Today's five    Fri Nov 20│ │ Fill every row, column…   │ │ Level 37, Easy             │
│ ┌──┐┌──┐┌──┐┌──┐┌──┐ dealt │ │ [ Continue: level 12 ]    │ │                            │
│ │  ││  ││  ││  ││  │ cards │ │ Gentle Easy Medium Tricky…│ │        game board          │
│ └──┘└──┘└──┘└──┘└──┘       │ │ 1  2  3  4  5  6  7 … 10  │ │                            │
│ 2 of 5 solved  [Play next]│ │ 11 12 …            (stars)│ │                            │
│ All puzzles               │ │ …                      100│ │  controls / number pad     │
│ ┌─────────┐ ┌─────────┐   │ │ How to play               │ │  status line (aria-live)   │
│ │ game    │ │ game    │ … │ └───────────────────────────┘ └───────────────────────────┘
```

- The signature moment is Today's five as a hand of cards dealt onto the felt when the panel opens;
  solved cards flip to show their stars. Keep everything else quiet.
- Win: ivory card, three brass stars stamped in, paper confetti on a canvas, "Next puzzle" as the primary button.
- Sounds synthesized with WebAudio (wooden clack for tiles, soft chime for correct, arpeggio for a win); can be turned off.
- Settings: table color, size (Standard / Large / Extra large), sounds, show Sudoku mistakes, open at login, reset progress.
- Header is the drag handle (pointer capture + bridge messages). Esc goes back; on Home it closes the panel.

State: `{v:1, settings:{}, prog:{<id>: "<500 chars '0'-'3'>"}, daily:{date, done:{id:stars}}, streak:{last, n}}`.

## Testing

- `node tools/test_puzzles.js`: loads engine + words + games under Node and generate every level of every game.
  Assert: Sudoku has exactly one solution; every word-search word is in the grid; pipes solution is a single connected
  tree; slide puzzles are not already solved; sums rounds have a solution of the stated size; sequence options contain
  the answer exactly once; no generator throws or takes > ~200 ms.
- Open `Resources/web/index.html` in a browser to play without building (falls back to `localStorage`).
- `scripts/build_app.sh --install` then click the menu bar icon. Check: keyboard input works in Word Guess,
  dragging by the header, progress survives quit and relaunch, all three sizes fit the screen.
