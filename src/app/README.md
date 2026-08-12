# App

React shell, routing, and campaign screens. Composition root: may construct
engine ports and wire orchestration into UI.

## Landed

- Career bootstrap and campaign hub
- Match screen, roster, and debrief surfaces
- Theme provider and onboarding track shells

## Important footgun

The interactive match path currently constructs a **fake** engine port for
tractability in the browser slice. Headless calibration and CI smoke use
`--engine=fake` or Lozza/Stockfish explicitly via `sim/`. Do not treat UI match
outcomes as balance evidence.

See `docs/playtest/milestone-4-vertical-slice.md` for the playable-slice note.
