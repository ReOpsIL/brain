# Brain Spark

Menu bar brain-puzzle game for macOS, for adults 55+. Read `PLAN.md` first: it has the status,
architecture, the spec for all 11 puzzles, the visual direction and the test plan.

- Native shell follows the patterns in `~/develop/move` (Chess Move). Reuse its approach for the
  status item, panel, build script and Info.plist.
- The game itself is plain HTML/CSS/JS in `Resources/web/` with no build step.
- Puzzle generators (`gen`) must stay pure and DOM-free so `tools/test_puzzles.js` can run them under Node.
- `Resources/web/js/words.js` is generated; edit `tools/build_words.js` instead.
