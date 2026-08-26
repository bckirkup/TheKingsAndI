# ADR 0062 — The decision journal: how a model may play without ever touching the game

- **Status:** proposed (2026-08-25). The owner has ruled the direction — **no
  live LLM during play** — and opens **D159–D163** for the schema and balance
  questions below.
- **Depends on:** ADR 0001 (deterministic core, narrative skin), ADR 0004 (no
  runtime LLM), ADR 0013 (a piece reasons from its own view), ADR 0025 (the
  opponent is a commander), ADR 0034 (the per-ply query barrier)
- **Related:** `sim/README.md`, `docs/testing_strategy.md`,
  `src/psychology/replay.ts`, `docs/calibration/`

## Context
The headless harness is the project's validation instrument, but the only
commander it can simulate is a move-picker. `HeadlessLeaderPort`
(`src/orchestration/headlessMatch.ts`) exposes `chooseMove` and
`shouldOverride`; everything else a commander decides — which squad to field
(`squadFielding.ts`), whom to consult (`counsel.ts`), what to bid (ADR 0059),
which crisis option to take (ADR 0040), whom to nominate (ADR 0050), whether to
keep going at all — is either app-side or a style-keyed heuristic inside the
seminar harness. So the harness cannot currently produce the failure we most
need to find: not a lost game, but a bored or frustrated commander.

We want models to play, because a scripted policy cannot be bored. But ADR 0004
removed the runtime LLM from the product entirely, and ADR 0001 forbids model
output from re-entering game state. A model that plays must therefore be an
*instrument*, not a dependency: it may not exist at runtime, it may not be
required to reproduce a result, and it may not be a term in any balance number.

The mechanism that makes this possible is already in tree and under-used.
`ReplayManifest` (`src/psychology/types.ts`) is `seed` + `roster` + frozen
per-ply intents, and `replayMatch` folds it back into an event log **with no
engine in the loop**, because each ply carries the engine's answer in its
recorded `moveEval`. That is a decision journal for one decision kind. This ADR
widens it to all of them and names the boundary a model may reach.

## Decision

### 1. A journal, not a transcript
A **decision journal** is the ordered, canonical record of every decision a
commander was asked to make, the observation it was shown, the option set it
could choose from, and the option it chose. It is written by `sim/`, it is
replayable without a model or an engine, and it is the only artifact a balance
sweep reads.

```ts
interface JournalEntry {
  readonly decisionIndex: number;        // monotonic within the journal
  readonly at: { match: number; ply?: number; kind: DecisionKind };
  readonly observation: Observation;     // what the commander was allowed to know
  readonly observationDigest: string;    // canonical hash; the cache key
  readonly options: readonly Option[];   // canonically ordered, engine-validated
  readonly chosen: number;               // an INDEX into options — never free text
  readonly rationale?: string;           // journal-only; no reducer may read it
  readonly agent: AgentIdentity;         // id + promptVersion + optionSetVersion
}
```

`DecisionKind` is a discriminated union over the real decision points — `move`,
`crisis_option` (ADR 0040), `override`, `field_squad`, `consult`, `bid`,
`nominate`, `dismiss`, `disengage` — and grows by adding a variant, never by
widening `chosen`.

### 2. Enumerate; never parse
Orchestration produces the option set; the agent returns an index. Move options
come from `legalScoredMoves`, crisis options from the ADR 0040 menu, bids from a
discrete rung ladder, and so on. Consequences:

- The model's text cannot reach game state, because no code path reads text.
  `rationale` is carried for human review and is excluded from every digest, the
  same way ADR 0033-style telemetry is. This is ADR 0001 enforced structurally
  rather than by convention, and it should be enforced the way the layer rules
  are: by lint.
- An out-of-range or absent index is a **refusal to decide** with a defined
  fallback (the scripted policy of record), logged as such. It is never a retry
  loop, because a retry loop is a wall-clock dependency.

### 3. The observation is a projection, and it is checked
`Observation` is what the commander may know: public record, own roster's
observable state, board, and the counsel it paid for. It may never carry the
true evaluation (ADR 0013), enemy psychological state (ADR 0025), or the audit
stream (ADR 0036). The projection is built by one function so the boundary has a
single test surface, and that test is a leak test, not a formatting test.

### 4. Ordering is the barrier's, not the clock's
Agent calls happen strictly *between* ADR 0034 barriers — never inside one — and
`decisionIndex` is assigned by the deterministic loop, so a journal's order is a
property of the game, not of the host or of how long inference took. Two further
rules follow:

- The seeded PRNG stream must advance identically whether or not an agent was
  consulted, exactly as `replayMatch` ticks `random.nextInt` per ply.
- Engine results consumed for a decision are recorded in the entry. Replay then
  needs no engine at all, which also removes the warm-engine path dependence
  (see `sim/README.md`) from every replayed prefix.

### 5. Reuse: replay, fork, counterfactual
A journal is reusable in three ways, and the third is why we are building it.

1. **Replay** — fold the journal; must be byte-identical, and a cache miss
   during replay is a hard error, never a fresh model call.
2. **Fork** — replay a prefix to `decisionIndex = k`, then ask an agent for
   decision `k` only. This is how a realistic scenario is generated: match 12
   with collapsed credence and three deserters costs a cheap NPC prefix plus one
   inference, not twelve model-played matches.
3. **Counterfactual** — same prefix, different agent or different option, and
   the divergence is attributable to that one decision because everything before
   it is frozen.

Responses cache on `observationDigest + agent`, so a repeated study is free and
a re-run is deterministic.

### 6. Models discover; scripted policies calibrate
This is the balance rule, and it is the part that is easy to get wrong.

- Coefficients are tuned **only** against scripted policies: seeded, cheap,
  sweepable, and stationary. Every knob keeps its sensitivity probe (AGENTS.md
  rule 6).
- LLM runs exist to surface behaviour a scripted policy cannot express —
  boredom, spite, over-overriding, hoarding, quitting. Their output is a
  *finding*, and a finding is only real once it is demoted into code: a new
  scripted policy or a new metric that reproduces it deterministically. That is
  what then gets swept.
- No committed balance number may depend on a model checkpoint. Changing the
  model id, `promptVersion`, or `optionSetVersion` re-baselines that evidence
  exactly as changing the engine does.

### 7. Frustration must be measurable to be balanced
Boredom is not a mood we infer; it is a decision we record. The journal carries
an explicit `disengage` option wherever it is plausible, and the metrics that
score it are first-class alongside win score: disengagement rate, decisions
until disengagement, override rate, refusal churn, and repeat-decision entropy.

### 8. Where this lives
The journal writer, the agent adapters, and every model call live in `sim/`.
`src/` gains only what the product needs anyway: the widened commander port and
the observation projection. There is no runtime LLM and no API key in the
shipped game (ADR 0004); a journal replays in the browser precisely because
nothing in it is a model.

## Consequences
- The harness can host non-move commander behaviour, which unblocks NPC careers
  and, later, model players, without a second orchestration path.
- Model cost scales with decisions studied, not campaign length.
- Replay stops depending on engine process state for any recorded prefix, which
  is a partial answer to the warm/cold engine question — it does not settle it.
- Cost: an option set must be enumerable for every decision we want a model to
  make. Where enumeration is awkward (a continuous bid), we discretise, and the
  discretisation becomes a balance parameter with its own probe.
- The journal is evidence about a person when a human plays (ADR 0030), so its
  retention, export, and consent story is the transcript's, not a new one.

## Open decisions
- **D159** — Which decision kinds are in the first journal, and which stay
  scripted?
- **D160** — What exactly is in `Observation` for each kind, and what is the
  leak test?
- **D161** — What is the fallback when an agent declines or answers out of
  range: scripted policy of record, or abandon the campaign as a disengagement?
- **D162** — How is a bid ladder discretised, and at what granularity?
- **D163** — How many model runs constitute a finding worth demoting into a
  scripted policy, and who rules on it?

## Alternatives considered
- **Free-text commands parsed into moves.** Rejected: parsing is where model
  output becomes game state, and a parser failure is indistinguishable from a
  bad decision.
- **A live model in the match loop.** Rejected by ADR 0004 and by the owner
  again here; it also makes every balance number non-reproducible and puts
  inference latency inside the ADR 0034 barrier.
- **Logging prompts and completions only (a chat log).** Rejected: a chat log
  cannot be folded, forked, or swept, so it produces anecdotes rather than
  evidence.
- **Letting the model tune coefficients directly.** Rejected: it would make a
  vendor checkpoint a term in the balance of the game.
