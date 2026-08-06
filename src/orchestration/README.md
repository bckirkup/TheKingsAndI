# Orchestration

Match loop and state mutation. The headless harness entry point is
`runHeadlessMatch` in `headlessMatch.ts`.

Player-side plies run the full psychology verdict ladder (refusal, override,
desertion, quiet quit). Opponent plies apply chess moves only. The event log is
the source of truth for metrics and replay.
