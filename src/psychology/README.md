# Psychology

Pure reducers and decision functions. No I/O, no clock, no ambient RNG — every
stochastic draw is injected. Orchestration is the only caller that mutates match
state after a psychology decision.

## Landed

- `ENGINE_CONFIG` — every knob is expected to ship with a golden **and** a
  sensitivity probe (`tests/psychology*.test.ts`,
  `tests/psychology.configCoverage.test.ts`)
- Deterministic math via `src/core/math.ts` (ADR 0032 §4)
- Search-depth allocation, tactical utility (no additive trust — ADR 0015)
- Two-channel credence (`τ_benev`, `τ_abil`) with heard/betrayal/neglect,
  ability observation, drip, and justified-refusal authority
- Full verdict ladder including desertion via `U_desert` vs `U_stay` (ADR 0011)
  and fatalistic compliance (ADR 0024)
- Override path with witness penalties (ADR 0014)
- Belief channels: geometric attention, rumor diffusion (ADR 0016)
- Witness appraisal of desertion (ADR 0018) and sacrifice attribution
- Outcome→trust and costly-signal credits (ADR 0007)
- Append-only `MatchEvent` union and deterministic replayer

## Not yet wired here

- Three-channel keyed credence (ADR 0035 / D49) — still `{tauBenev, tauAbil,
  abilityObservationCount}`
- Crisis-menu / reciprocal-authority UI surfaces (ADR 0040 / 0042) — reducers
  exist where noted; presentation is orchestration/app work

## Entry points

| File | Role |
|---|---|
| `config.ts` | Normative coefficients |
| `utility.ts` / `verdict.ts` | Move utility + verdict ladder |
| `desertion.ts` / `cascade.ts` | Expected-cost desertion + cascade |
| `credence.ts` / `belief.ts` | Perception weight + rumor/attention |
| `trust.ts` / `override.ts` / `witness.ts` | Outcome, override, sacrifice/desertion witnesses |
| `events.ts` / `replay.ts` | Event append + replay digest |
