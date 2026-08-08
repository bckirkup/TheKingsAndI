# ADR 0037 — Private per-piece evaluation: bounded distortion and pruned attention

- **Status:** accepted
- **Resolves:** the `EvalProfile` schema question deferred by D43
- **Refines:** ADR 0013 (own view), ADR 0016 (interpretive belief), ADR 0017
  (shared search, private scoring), ADR 0018 (testimony), ADR 0019 (attention
  pruning), ADR 0021 (the King's attention), ADR 0032 (deterministic math),
  ADR 0034 (the per-ply query barrier)
- **Related:** ADR 0035 (three-channel credence), ADR 0036 (separate engine
  audit stream)

## Context

The authored design says that a piece's view is an evaluation function plus an
attention pattern and a leader prior (`docs/belief_model.md` §1). ADR 0017
therefore requires shared search and private scoring:

```text
shared   one search from the pool over the current position → leaf set
private  for piece i: re-score those leaves under i's own weights,
         truncate to D_i, extend only i's attention lines
cache    keyed (position, D_i, evalProfile_i)
```

The current transport type deliberately leaves the profile opaque:
`EvalProfile = Readonly<Record<string, number>>` (`src/engine/types.ts:9-16`).
The profile factory is still an empty placeholder (`src/orchestration/insight.ts:
26-30`), and the broker currently adds the truncated integer sum of profile
values to the shared score (`src/engine/broker.ts:30-58`).

That placeholder cannot be the private evaluation model. UCI supplies a scalar
centipawn score and a principal variation, not the engine's internal evaluation
terms (`src/engine/types.ts:18-24`; `src/engine/uci.ts:25-31`). The phrase
"re-score the leaves under i's own weights" in ADR 0017 therefore cannot be
implemented by asking a UCI engine to expose terms it does not provide. The
project must apply its own feature-based interpretation to the PV-endpoint
positions, using plain geometric board features from `src/chess/features.ts`
(`src/chess/features.ts:11-18`).

A flat score offset is inadequate: it can change how good a piece thinks the
position is, but it cannot change which move it prefers. Refusal can therefore
never acquire a tactical reason from that mechanism.

## Decision

### 1. Private evaluation is bounded distortion of the shared score

The engine scalar at the piece's selected depth rung remains the tactical base.
The piece's egocentric evaluation displaces that base by a bounded amount. The
private result is therefore a bounded distortion of shared tactical evidence,
not a replacement for it.

The distortion is computed by the project's own feature-based evaluation over
the PV-endpoint positions and plain board features. It is not a request for
internal UCI evaluation terms, which are not part of the engine port.

The existing `applyPrivateScoring()` behavior — summing truncated profile values
and adding the result to `scoreCp` — is a placeholder superseded by this ADR.
It is inadequate because a flat offset changes only the scalar's magnitude and
never changes move preference; a refusal produced through it can never have a
tactical reason.

The amount of displacement is a calibration coefficient and must ship as a
configuration knob with both a golden test and a sensitivity probe, per the
project's rule 6. It controls how far a piece's universe may diverge while
remaining wrong in a plausible way. This ADR does not choose its value.

### 2. Attention prunes the private view

Attention follows ADR 0019's resolution of D41. Lines the piece does not appear
in are removed from its private view rather than merely deprioritized. Lines
containing the piece or its high-affinity peers survive.

A piece can therefore be structurally incapable of seeing why a deep move is
good. That is intended: attention is part of the interpretive failure mode, not
an optimization detail.

Pruning requires a wider MultiPV result than the broker currently requests.
The current default is `multiPv: 3` (`src/engine/broker.ts:95-100`), and three
lines will frequently leave a piece with nothing after pruning. MultiPV width
is therefore a parameter of this design. Widening it multiplies engine cost,
and the acceptable width must be measured against the Milestone 3 calibration
runtime budget. This ADR does not choose the width.

### 3. Geometric salience modulates pruning, not the depth rung

Salience is geometric: it decays with board distance and behind blocked lines
(`docs/belief_model.md:116-129`). Salience determines which lines survive
attention pruning and how relevant those lines are to the private view.

Baseline `D_i` remains exactly the depth computed from experience and
engagement by `src/psychology/depth.ts`. This ADR does **not** adopt
per-line depth allocation.

`EngineEvaluation` represents one scalar score and one PV, not different
depths for different lines (`src/engine/types.ts:18-24`). Per-line re-search
would also require issuing a query in response to another query's answer within
the same round, which ADR 0034 forbids:

> A query may not be issued *because of* another query's answer within a round.

The authored phrase "depth allocation over the same tree" in ADR 0017 is
therefore narrowed here: in this implementation, it is realized as line
survival through geometric pruning at one selected depth rung. No adaptive
per-line search is part of this decision.

### 4. The King is unpruned

The King is the explicit exception from ADR 0021. His attention has global
breadth and bounded depth: no line is pruned, while `D_king` remains bounded.
His evaluation profile makes self-safety the objective, as specified by ADR
0021. `PieceState` remains uniform; the exception is the King's attention mask
and evaluation objective.

### 5. D43 trauma drift remains open

Whether egocentric weights drift with `B_i` is not resolved by this ADR. It
remains the user's open D43 question: drift would give `B_i` a perceptual job
as well as an affective one.

If this behavior is implemented, it must ship behind a configuration flag with
both branches tested. This preserves the open design choice while making either
calibration branch explicit and reproducible.

### 6. The transport remains opaque and canonical

The engine-boundary type remains:

```ts
type EvalProfile = Readonly<Record<string, number>>;
```

This ADR settles what the keys mean and who constructs them; it does not widen
the engine boundary with psychology-specific named fields. The barrier only
needs canonical data, and the cache key already includes the profile:

```text
(position, D_i, evalProfile_i, determinismId)
```

(`src/engine/cache.ts:31-44`).

The complete profile must be determined before the barrier issues the round's
requests. Profile values must be integer-quantized before accumulation, so
accumulation order cannot affect the result. Canonical serialization remains
the identity boundary for cache and replay data.

## Binding constraints

### ADR 0013 — own evaluation only

The true evaluation must never reach `psychology/`. `evaluateTrue()` remains on
the orchestration audit path only (`src/engine/broker.ts:140-143`). Under ADR
0036, its persistence belongs to the separate audit stream, not the event log.
The private score supplied to psychology is the piece's own bounded view.

### ADR 0016 — interpretive, never factual divergence

This ADR does not permit a piece to be wrong about a board fact. No piece is
ever wrong about where a piece stands. The instinct toward pieces inhabiting
their own perceptual universe is served by bounded distortion and pruning:
they differ about meaning, salience, and tactical importance, not location.

Genuine factual divergence would require superseding ADR 0016 and introducing
per-observer board state. That design is explicitly not adopted here.

### ADR 0018 — reasons must name causes

A stated reason must always name a real cause. Attention pruning must not
produce a refusal with no nameable cause. The testimony layer may rationalize,
but the underlying refusal must remain attributable to the piece's private
evaluation, its surviving attention lines, or another recorded psychology
cause.

### ADR 0032 — deterministic mathematics

The banned `Math.exp`, `Math.pow`, `Math.log`, trigonometric functions, and `**`
remain forbidden in `psychology/` and `chess/`. If geometric decay needs a
nonlinear curve, it must use the deterministic math module in `src/core/math.ts`
and its quantized comparison lane.

`src/psychology/belief.ts:6-11` already contains a linear `attentionWeight()`
using `ATTENTION_DISTANCE_DECAY = 0.15`. No production path currently calls
that helper. Whether that linear curve is adequate, and therefore whether it
becomes the normative curve, is calibration; this ADR does not choose a
different curve or coefficient.

## Consequences

**The profile construction boundary must widen.** `evalProfileFor(piece)`
currently receives only `PieceState` (`src/orchestration/insight.ts:79-93`), so
it cannot see board geometry. Geometric salience requires the board or plain
geometry derived from it. The construction interface must therefore change; this
ADR does not design that interface.

**The leader seat stays unprofiled.** The leader/player insight seat is not a
piece. It remains an undistorted view at `PLAYER_EFFECTIVE_DEPTH` with `{}`:
the leader view is the tactical reference against which the piece's private
interpretation and credence are compared, not another piece's egocentric mind.

**Engine adapters must converge on the same contract.** Lozza currently ignores
the profile (`src/engine/adapters/lozza.ts:46-52`), while the fake engine mimics
the placeholder additive bias (`src/engine/fake.ts:12-34`). Both must later be
brought into line with the conformance corpus, or the harness will measure a
different model from the game.

**Calibration must be redone.** Existing psychology coefficients were calibrated
against an inert divergence channel. They must be re-derived after bounded
distortion and attention pruning are active.

**Credence remains a separate state-model dependency.** ADR 0035's
three-channel credence model is documentation-only at present; code still has
scalar credence. The profile must not assume disposition or per-commander
relationship accounts exist.

## Alternatives considered

- **Flat additive profile bias.** Rejected: it cannot change move preference,
  cannot supply a tactical refusal reason, and is only the current placeholder.
- **Per-line adaptive depth.** Rejected: `EngineEvaluation` cannot represent it,
  and adaptive re-search inside a barrier round violates ADR 0034.
- **Perceptual fog or factual board divergence.** Rejected: it contradicts ADR
  0016 and would require per-observer board state.
- **Leave attention as a line-priority hint.** Rejected: ADR 0019 resolves D41
  as pruning, which is the intended structural incapacity rather than a softer
  ordering preference.
