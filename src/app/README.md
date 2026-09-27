# App

React shell, routing, and campaign screens. Composition root: may construct
engine ports and wire orchestration into UI.

## Landed

- Career bootstrap and campaign hub
- Match screen, roster, and debrief surfaces
- Theme provider and onboarding track shells

## Important footgun

The interactive match path constructs a real engine port: the vendored
`lozza.cjs` runs as a classic Web Worker behind the same `UciEngine` adapter
as the harness (`src/engine/workerLozza.ts`; `src/engine/README.md` documents
the node/bundle split). Its `determinismId` names the same vendored artifact
and policy tokens as the Node Lozza port, so a browser journal is comparable
to a harness journal. The headless harness selects among all four ports via
`sim/`: `--engine=lozza` (default), `stockfish`, `caissa` (opt-in via
`CAISSA_ENGINE_PATH`), or `fake`. Browser matches search at the psychology
layer's per-piece `D_i` depths; the harness-only `--depth-cap` tractability
wrapper is not part of the app path.

See `docs/playtest/milestone-4-vertical-slice.md` for the playable-slice note.
