# 2026-09-27 — The authored model and the two lanes

How a real model plays this game without the shipped package ever containing
one, and what "no runtime LLM" (ADR 0004) permits besides.

## The boundary, stated plainly

ADR 0004 bans an LLM at runtime. Everything else is offline authoring, and it
comes in two lanes that must not be conflated:

| Lane | What the model does | Artifact | Where it lives |
|---|---|---|---|
| **Content** | Composes text/assets a human would author (dialogue tree lines, pack prose, sprites) | Static files in the shipped bundle | `src/`, `public/`, `assets-src/` |
| **Instrument** | Plays headless matches to surface behaviour a scripted policy cannot express (ADR 0062 §6) | Committed decision journals | `sim/`, `docs/calibration/` |

The shipped game consumes neither the model nor its stream. Lane 1's output is
indistinguishable from human-authored content once committed. Lane 2's output
is a journal — replayable with no model and no engine, and a balance number
may only ever be derived from *scripted* policies; model evidence is a finding
until demoted into code (ADR 0062 §6).

The new `no-runtime-llm` eslint block makes lane 2's boundary structural: no
LLM SDK may be imported under `src/` or `tests/` — the same mechanism that
enforces the layer rules and the transcendental ban.

## How a model plays without provisioning (measured this session)

The model is a Devin session. `sim/authoredPersona.ts` + two flags on
`containmentCli`:

```
node --import tsx sim/containmentCli.ts --persona=bored --seed=7 \
  --engine=fake --dump-asks=asks.json     # every ask the persona is shown
# …session authors responses.json: decisionIndex → {chosen, rationale, at?}
node --import tsx sim/containmentCli.ts --persona=bored --seed=7 \
  --engine=fake --responses=responses.json --journal=journal.json
```

`--dump-asks` and `--responses` compose: dumping *with* responses applied
records the asks along the deviated trajectory — the iteration loop, because
deviating at decision `k` reshuffles which ask sits on each later index.
Authored responses are keyed by `decisionIndex` and carry an optional `at`
kind-guard so a stale index cannot land a fixed-menu pick on the wrong ask
kind. Unanswered asks defer to the persona's scripted policy, so sparse
authoring is the intended mode: the model touches only the decisions that
matter (the stands, the walk-away). `JournalAgent.decide` may now return
`{chosen, rationale}`; the rationale lands on that entry and is excluded from
every digest per ADR 0062 §2.

The authored journal's `AgentIdentity` stamps `promptVersion:
"authored:<digest8>"` over the responses file contents — the provenance hash
is the artifact's identity, exactly as a vendor checkpoint would be.

### Proof artifact

`sim/authored/reluctant-bored-seed7.json` — a "won't force the pieces"
commander: stands at five straight mutinies, then disengages at the sixth
(`bored` persona, seed 7, fake engine, `--opponent=tyrannical`). All six
authored entries land with rationale; `uncoveredDisengage=2` (the authored
walk-away at decision 15 plus a scripted one at 29 — disengaging on an
override ask does not end the match; override-ask walk-aways are
walk-aways-from-the-ask, not resignations).

Two passes were needed to land the exit — an honest demonstration of why the
dump→author→replay loop exists.

## What this does not yet do

- **Full-match authorship.** Sparse deviations only; authoring every ask of a
  30-decision match is session labor (~three dump passes here). Per ADR 0062
  §6 that is the right cost shape — models exist for findings, not sweeps.
- **The §5 fork with depth replay.** A fork must replay the parent's per-piece
  `D_i` and ladder depths (0062 addendum); the authored path replays nothing —
  it re-runs the match and applies responses live, so no machinery for fork
  exists yet.
- **The API adapter (path A).** A provider-backed `JournalAgent` over the same
  seam — same `AgentIdentity` provenance, responses caching on
  `observationDigest + agent` per §5 — is the repeatable version once an
  inference budget is ruled. It stays under `sim/` and must never appear in a
  committed balance number.
- **D161/D163 remain open** (fallback on decline; how many runs make a
  finding).

## Open questions for the owner

1. Should authored journals be committed per persona (provenance, like this
   one) or stay session artifacts cited by hash?
2. Path A trigger: rule a budget when an authored session produces a finding
   scripted personas can't demote (e.g. a behaviour with no sparse-deviation
   expression).

## Raw artifacts

- `sim/authored/reluctant-bored-seed7.json` (committed responses file)
- Journal reproduction: `node --import tsx sim/containmentCli.ts --persona=bored
  --matches=1 --seed=7 --engine=fake
  --responses=sim/authored/reluctant-bored-seed7.json --journal=<out>.json`
- Asks dump: same command with `--dump-asks=<out>.json` (with or without
  `--responses`).
