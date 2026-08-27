# ADR 0063 — Two duties: the NPCs owe coverage, the models owe containment

- **Status:** accepted (2026-08-26) for the duties and the journal schema
  (**D159–D163**); **not wired** — no journal, observation projection, or
  envelope metric exists in tree yet. Opens **D164**.
- **Refines:** ADR 0062 (the decision journal and the LLM player)
- **Depends on:** ADR 0001 (deterministic core), ADR 0004 (no runtime LLM),
  ADR 0013 (a piece reasons from its own view), ADR 0024 (warmth is not required
  to win), ADR 0025 (the opponent is a commander), ADR 0034 (the query barrier)
- **Evidence:** `docs/calibration/2026-08-26-npc-coverage-and-the-envelope.md`

## Context

ADR 0062 established *how* a model may play — through a journal, offline, never
touching game state — but left open what either population is *for*. Without
that, the harness accumulates runs and no run can fail. The owner's ruling of
2026-08-25 supplies it:

> The duty of the NPCs is to make sure that a range of behaviors leads to
> feasible play for the students. The duty of the LLMs is to tune emotion into
> the thing and show that emotional humans won't run outside of what
> semi-rational (but not too bright) NPCs would imagine the right thing to do.

Two populations, two duties, and each duty is falsifiable — which is what this
ADR writes down.

## Decision

### 1. The NPC population owes coverage

The nine styles in `sim/cli.ts:36-56` are not nine opponents to defeat. They are
the span of semi-rational, not-especially-bright play a student might plausibly
bring, and their duty is to establish that a *range* of such play leads to
feasible campaigns. The duty is met when every style completes campaigns, no
degeneracy detector fires, and no style is strictly dominated **and** the span
separates on the axes a student experiences — outcome and roster feeling. A span
that collapses to a point fails the duty even when every run finishes, because a
student's own variation then has nothing to vary along.

Coverage is therefore a *gate on the NPC population*, measured without any
model: nine seeded runs and the existing detectors. The first such measurement
(2026-08-26) reports the duty as partly failed, which is why §5 opens D164.

### 2. The LLM population owes containment

A model's job is not to play well. It is to carry emotion into the same
decisions and show that an emotional human stays inside the envelope the NPC
span already covers. **The null result is the desired result:** contained model
play is evidence the game is feasible for people and not merely for policies. An
escape from the envelope is the finding, and it names the thing to fix.

This is why a model may never calibrate a coefficient (ADR 0062 §7): its output
is a *test of the span*, and a term cannot be both the test and the thing
tested.

### 3. Containment is computed from the journal, never from a second run

A journal entry records the whole canonically ordered option set, not only the
chosen index, so every entry can be scored against every NPC style after the
fact with no further inference and no model call: replay the entry's observation
to each scripted policy, collect the option each would have chosen, compare.

```ts
interface Containment {
  readonly envelope: readonly number[]; // option indices some NPC style would choose
  readonly inEnvelope: boolean;         // chosen ∈ envelope
  readonly distance: 0 | 1 | 2;         // 0 in; 1 adjacent rung; 2 unranked by all
}
```

`distance` is `1` when the chosen option is an adjacent rung of the same ladder
as an enveloped option — a neighbouring bid, a neighbouring-ranked move — and `2`
when no scripted policy ranks it at all. `outOfEnvelopeRate` is reported per
decision kind, because escaping on `override` means something different from
escaping on `move`.

Two derived signals carry more weight than the aggregate:

- An **uncovered `disengage`** — the model quits where no NPC style would — is the
  sharpest available evidence that a campaign is *emotionally* infeasible while
  remaining mechanically feasible. A scripted population cannot produce this
  signal, which is the whole reason models are run.
- A **distance-2 cluster** at one situation key is a menu gap: the option a human
  wants does not exist. The fix is a new option or mechanic, not a coefficient.

### 4. D159–D163 are answered as proposed

- **D159** — the first journal carries `move`, `override`, and `disengage`.
  `move` is recorded per `chooseMove` attempt, so re-plans after a refusal are
  separate entries and refusal churn is measurable; `override` is recorded only
  where `headlessMatch` asks `shouldOverride` on a `MORAL_REFUSAL`; `disengage`
  is an option appended to both option sets rather than a third ask. Deferred:
  `crisis_option` (ADR 0040 is unimplemented — journalling it would mean
  inventing the menu, which is D97–D99's job), `field_squad`/`dismiss`/`bench`
  (slice 2 — fielding today is a fixed `FieldingPolicy` knob passed to
  `fieldSquad`, so its first honest option set is those three policies),
  `bid`/`consult` (slice 3 — both live only in the seminar loop).
- **D160** — an observation carries only the qualitative band words the player is
  already shown (`src/ui/qualitativeLabels.ts`), never a raw psychological
  scalar. Bands are also the reason journals survive a re-baseline: a
  coefficient change that stays inside a band leaves observation digests
  byte-identical. Forbidden by name: true engine evaluation, the ADR 0036 audit
  stream, `privateEvaluation`, enemy-side psychology (ADR 0025), and the private
  numbers the event log carries — `REFUSAL` holds `utility`, `threshold` and
  `perceivedValue`, so **the event log is not an observation** and no observation
  may be built by spreading a `MatchEvent` or a `PieceState`. One projection
  function per kind owns the boundary, tested by a leak test that walks every
  emitted observation and fails on any leaf equal to a forbidden scalar from the
  same run — a whitelist test passes on an accidental spread; this one does not.
- **D161** — a declined or out-of-range answer is an `abstain`, recorded with
  `chosen: -1`, `resolvedBy: 'fallback'` and the `fallbackPolicy` that resolved
  it. It is never read as disengagement: an adapter bug, a truncated response or
  a network error must not be able to masquerade as boredom, which is the metric
  being measured. There is no retry, because a retry makes the number of model
  calls — and therefore the result — depend on wall-clock behaviour, which ADR
  0034 forbids in spirit. `abstentionRate` is reported as an instrument-health
  metric; a run with a high one is a fault, not evidence.
- **D162** — the bid ladder is derived, not chosen: `pass`, then
  `max(lot.minimumBid, MINIMUM_BID)`, then `bidForLot` at the three existing
  `BID_MULTIPLIER_*` values, then the remaining purse; integers, deduped, sorted,
  clipped, with collapsed rungs dropped rather than padded. No new magnitude, and
  a model can never bid a price the economy could not have produced. Since the
  rungs derive from config, `optionSetVersion` includes a digest of the
  draft-economy config.
- **D163** — a candidate becomes a finding when out-of-envelope behaviour of the
  same kind recurs across at least two distinct NPC prefixes at one pinned model
  id and promptVersion, and it is demoted into code as either a widened NPC
  policy (coverage was too narrow) or a new option/mechanic (the menu was too
  narrow), with a metric that detects it running on scripted runs thereafter. I
  may add metrics, detectors and NPC policies from a finding; any shipped
  coefficient change or new mechanic is an owner ruling with its own decision id.
  No committed balance number cites a journal — it cites the scripted
  reproduction.

### 5. Containment is not measurable until the span ranges (D164)

The 2026-08-26 coverage measurement finds the span compressed on both axes a
student actually experiences: four of nine styles tie at exactly 100.00 win
score with identical 20/0/0 records, and τ_benev ends at 73.6 for `supportive`
against ≤ 8.0 for every other style, with trust at the floor for eight of nine.
An envelope built from that span would call almost any warm behaviour
out-of-envelope and almost any cold behaviour identical, so containment
measured against it would be an artifact of the compression rather than a fact
about human play.

Widening is therefore a precondition, and because widening changes balance it is
an owner ruling, recorded as **D164**: which axis is widened first (a
demandingness axis independent of warmth, so that "cold" and "demanding" stop
being the same style; and an outcome ceiling that separates the four tied
styles), and what magnitudes that costs. This ADR does not choose it.

**Amendment, 2026-08-27 — D164 ruled; half the precondition is met.**
Insistence is now independent of care (`exacting`, `absentee`, `steady` at
`sim/leaders.ts:275-325`), and the outcome tie turned out to be a measurement
artifact of the default `random` opponent rather than a ceiling: at
`--opponent=tyrannical` the four tied styles score 82.5 / 65.0 / 40.0 / 30.0.
Coverage sweeps are therefore run against `--opponent=tyrannical` from here on.
The emotional axis did **not** widen — τ_benev is still 82.1 for `supportive`
against ≤ 12.4 for everything else — so the ordering in §5 stands: **no
containment number may be quoted yet.** The reason it did not widen is the open
D165, and it is structural rather than a magnitude accident: the only write that
*raises* `tauBenev` is compliance under private doubt (`+15`), override costs a
saturated `-40`, honouring a refusal earns nothing, and no benevolence write
reads protective features at all — so the channel is a compliance meter that no
NPC style can widen, and the emotional axis is a psychology question rather than
another leader policy. Evidence:
`docs/calibration/2026-08-27-the-competent-opponent-and-the-two-axes.md`.

## Consequences

- Every NPC run has a pass/fail duty, so the harness can report a *failed
  coverage gate* rather than a table.
- Every model run has a null hypothesis and cannot be run "to see what happens".
- Containment costs no extra inference: it is a fold over journals, so re-scoring
  the whole corpus after adding a tenth NPC style is free.
- The envelope is only as honest as the span, so the coverage gate must pass
  before any containment number is quoted. That ordering is the point of D164.

## Rejected alternatives

- **Scoring model play by win rate.** It measures the wrong duty entirely; a
  model that plays worse than every NPC is fine, and one that plays outside the
  span while winning is the failure.
- **Treating out-of-envelope play as model error.** Sometimes it is a menu gap
  (distance-2 clusters), which is a design finding, not a bad sample.
- **Widening the span by tuning against model traces.** Circular: the span is the
  yardstick, so fitting it to the thing being measured destroys the measurement.
