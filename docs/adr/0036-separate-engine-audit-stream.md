# ADR 0036 — The separate engine audit stream: truth at rest, belief in psychology

- **Status:** accepted
- **Resolves:** **D50** (where the true engine evaluation is persisted)
- **Refines:** ADR 0013 (pieces reason from their own knowledge), ADR 0018
  (audit), ADR 0019 (two-channel trust), ADR 0029 (the world ends with the
  curriculum), ADR 0030 (the transcript)
- **Related:** ADR 0034 (the deterministic query barrier)

## Context

D50's register framing is exact:

> The audit (ADR 0018) and the trust-farming detector (ADR 0019) need it, but
> persisting truth beside belief inflates the payload and places the forbidden
> number inside the save file, where a future loader may read it into psychology
> by accident.

The true engine evaluation is needed for audit truth, but ADR 0013 forbids it
from reaching `psychology/`. That boundary must therefore hold at rest as well
as at runtime. Persisting the true value in the event log would put it in the
same save payload as the psychology facts, one careless loader away from a
piece's head.

The current implementation also mixes sources without recording which source
was used. `orderQualityCp` is declared on the psychology-owned `MOVE` event
(`src/psychology/types.ts:114-123`) and is populated from the true audit score
in `src/orchestration/matchSession.ts:229-234`. The same path writes authored
`40` values during succession (`:431` and `:487`), while
`src/persistence/folds.ts:35` and `:89` supply verdict-based values and a
`50` fallback. Nothing in the recorded value distinguishes a measured engine
score from an authored or placeholder score. Board quality can therefore
silently average all three.

## Decision

### 1. True evaluations live in a separate audit stream

The true engine evaluation **is persisted**, but it is persisted outside the
event log. The audit stream is a separate persistence boundary that the
psychology loader has no code path to read. The event log remains the source of
psychology truth; the audit stream records the engine truth needed by audit,
trust-farming detection, and later evidence work.

This is an invariant, not a recommendation: the forbidden value must be
separated from psychology at rest, not merely omitted from the function call
that computes a verdict.

### 2. Every audit score carries provenance

Every persisted audit score must state its provenance. A true engine evaluation
must identify the engine's `determinismId` and search depth. An authored or
placeholder value must be explicitly marked as authored or placeholder. These
sources must never be silently averaged as though they were the same
measurement.

The audit score therefore moves **off** the psychology-owned `MatchEvent`
type. Its current placement as `orderQualityCp` is the de facto resolution in
the forbidden direction and must be removed as part of implementing this ADR.
The event log may retain the psychology event needed for replay, but it must not
carry the true score or an unproven score whose provenance is unknown.

### 3. The stream is droppable

The audit stream is optional save data. A shipping save must remain loadable and
playable when it is absent. Missing audit data degrades audit fidelity,
counterfactual analysis, and certificate verifiability; it must not degrade
loading, live play, or replay of the psychology state from the event log.

Dropping the stream is therefore a supported loss of evidence, not a corrupted
psychology save.

### 4. The boundary is enforced structurally

`psychology/` must not import, read, or receive the audit stream. Layering and
lint must enforce this in the spirit of the existing layer-boundary rule; it
must not depend on a convention or reviewer memory. The audit stream belongs
behind an orchestration/persistence boundary that has no import path into
`psychology/`.

The per-ply query barrier remains the collection point for the true value:
orchestration may send it to the audit stream, while the psychology-facing
bundle receives only the piece's own view and other permitted plain data.

## Consequences

**The score field must move.** `orderQualityCp` must migrate off
`MatchEvent`, and `src/persistence/folds.ts` must be repointed at the audit
stream rather than deriving board-quality measurements from psychology events.

**Existing authored values are audit-fidelity bugs.** The two hardcoded `40`
values in succession and the `?? 50` fallback are latent bugs. They must later
be either replaced with measured evaluations or explicitly marked as authored;
this ADR does not implement that work.

**Certificates must declare their audit dependency.** The certificate defined
by ADR 0029/0030 must say whether it carries the audit stream. With the stream,
it can be replay-verified without the original engine build. Without it,
verification depends on the pinned engine remaining available and bit-identical
across hosts, which is currently unproven.

**Counterfactual reruns are gated.** Milestone 5.8p needs per-position truth;
the separate audit stream is a prerequisite for those reruns.

**Retention and size require policy.** The stream is per-ply and per-position,
so it is the largest component of a save. A retention policy is required, but
this ADR does not choose one.

## Open questions

- **Facilitator exposure — owner: user.** Whether facilitator and cohort audit
  surfaces may expose true evaluations is left open, just as ADR 0035 left the
  analogous disposition question open.
- **Retention policy — owner: user.** The retention, compaction, and export
  policy for the per-ply audit stream remains open.

## Alternatives considered

- **Persist true evaluations in the event log.** Rejected: it places the
  forbidden value beside psychology facts in the save file and makes the
  epistemic boundary depend on every future loader remaining careful.
- **Keep true evaluations ephemeral.** Rejected: ADR 0018's audit and ADR
  0019's trust-farming detector need the measured value, and later
  counterfactuals and certificates cannot be evidence-backed without it.
- **Leave provenance implicit.** Rejected: the current mixture of true scores,
  authored constants, and fallbacks would continue to produce an aggregate
  whose evidentiary status cannot be recovered.
