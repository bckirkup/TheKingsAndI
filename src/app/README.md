# App

React shell, routing, and campaign screens. Composition root: may construct
engine ports and wire orchestration into UI.

## Landed

- Career bootstrap and campaign hub
- Match screen, roster, and debrief surfaces
- Theme provider and onboarding track shells

## Important footgun

The interactive match path currently constructs a **fake** engine port
(`ui-fake/depth-fixed`) for tractability in the browser slice — the real
adapters cannot run in the bundle yet (`src/engine/README.md` documents the
node/bundle split; ADR 0079 step 1 is the Lozza-WASM-in-a-worker plan). The
headless harness selects among all four ports via `sim/`:
`--engine=lozza` (default), `stockfish`, `caissa` (opt-in via
`CAISSA_ENGINE_PATH`), or `fake`. Do not treat UI match outcomes as balance
evidence.

See `docs/playtest/milestone-4-vertical-slice.md` for the playable-slice note.
