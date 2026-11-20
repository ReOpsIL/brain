# Brain Spark

A brain-puzzle game that lives in the macOS menu bar, made for adults 55 and over. Click the puzzle-piece
icon near the clock and the game table drops down.

- 11 puzzles in five categories: Word Search, Word Scramble, Word Guess, Sudoku, Pipes, Pairs,
  Pattern Recall, What Comes Next, Sum It Up, Odd One Out and Sliding Tiles.
- 500 levels of each (5,500 numbered puzzles), from gentle to expert. Nothing is locked.
- **Today's five**: one puzzle of each kind every day, with a streak for finishing all five.
- Large type, big buttons, strong contrast, hints everywhere, no timers.

## Build and run

Requires macOS 14 or later and the Swift toolchain (Xcode or the command line tools).

```bash
scripts/build_app.sh --install
```

This builds `build/Brain Spark.app`, copies it to `/Applications` and opens it. Leave off `--install` to only build.
Left-click the menu bar icon to open or close the game; right-click it for Today's Five, Open at Login and Quit.

To package the app as a disk image for sharing:

```bash
scripts/make_dmg.sh
```

This writes `build/BrainSpark-<version>.dmg`. The app is ad-hoc signed and not notarized, so on another Mac the
first launch has to be allowed in System Settings > Privacy & Security ("Open Anyway").

Progress is saved in `~/Library/Application Support/BrainSpark/state.json`.

## Play in a browser

The game itself is plain HTML, CSS and JavaScript with no build step. Serve `Resources/web` and open it:

```bash
python3 -m http.server 8765 --directory Resources/web
```

In a browser, progress is kept in `localStorage` instead.

## Tests

```bash
node tools/test_puzzles.js
```

Generates every level of every game and checks it: each Sudoku has exactly one solution, every word-search
word is in its grid, each Pipes layout is a single connected tree, and so on. Pass game ids to test only those,
for example `node tools/test_puzzles.js sudoku pipes`.

## Layout

| Path | What |
| --- | --- |
| `Resources/web/` | The game: `index.html`, `css/app.css`, `js/engine.js`, `js/games/*.js`, `js/app.js`, fonts |
| `Sources/BrainSpark/` | The Swift menu bar shell (status item, panel, web view, saved state) |
| `scripts/` | `build_app.sh`, `make_dmg.sh` and the icon generator |
| `tools/` | Puzzle tests and the word-list generator |
| `PLAN.md` | The full spec: architecture, puzzle rules, design direction |

`Resources/web/js/words.js` is generated. To change the word lists, edit `tools/build_words.js` and run
`npm install wordlist-english && node tools/build_words.js`.

## Credits

Word lists are derived from [SCOWL](http://wordlist.aspell.net). Fonts are Fraunces and Atkinson Hyperlegible,
both under the SIL Open Font License.
