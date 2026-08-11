# ADR 0039 — Credence has prior strength, and the first match is not a verdict

- **Status:** proposed
- **Resolves:** **D95** (how fast may a piece revise its read of a commander?),
  **D96** (what does a piece observe before a participant's first match?)
- **Refines:** ADR 0015 (trust as credence), ADR 0019 (two-channel trust),
  ADR 0035 (three-channel credence)
- **Related:** ADR 0007 (trust does not decay toward a baseline), ADR 0013 (each
  piece decides from its own view), ADR 0022 (succession is computed, never
  scripted), ADR 0025 (both armies are led), ADR 0027 (cohort-first),
  ADR 0029 (the world ends with the curriculum)

## Context

`applyAbilityObservation` moves `τ_abil` by `ABIL_BAYES_NUMERATOR / n`, where
`n` counts the ability observations so far:

```ts
const n = Math.max(1, observationCount);
const step = Math.trunc(ENGINE_CONFIG.ABIL_BAYES_NUMERATOR / n); // 100 / n
```

With `ABIL_BAYES_NUMERATOR = 100` and a credence scale of 0–100, the **first**
observation moves `τ_abil` by the entire scale, the second by half of it, and
the third by a third. A piece that watches one order go badly at ply 3 has
already concluded everything it will ever conclude about its commander; the
clamp, not the evidence, decides where it lands. The harness shows exactly
that: in an 8-match supportive campaign, `τ_abil` reads 14.19 in the first
quartile and 0.00 in the second, and never recovers.

This is not a coefficient that needs sweeping. The update treats the piece's
starting credence as carrying *no* evidential weight, which is not what a
Bayesian step of the form `numerator / n` means. `n` is the count of
observations; a prior is worth some number of them, and here that number is
implicitly zero. Every downstream calibration attempt inherits the error, which
is why sweeping `ABIL_BAYES_NUMERATOR` across 0, 20, and 100 moved the refusal
rate from 0.9888 to 0.9913 — the regime is set before the knob can matter.

The owner asked the design question this raises directly:

> will it be that the pieces will observe a weak opening conditional on the
> opposition moves early in the game? how fast? will it be necessary for new
> players to go through a game-mechanics-only game? will it be necessary for
> every player in a seminar to win the first game with their pieces (so it
> can't be against a human) or should that be conditioned into the pieces
> universally but not in a way that personalizes them?

Two separate questions live in there. **How fast may a read form?** — a
psychology-model question. **What has a piece already seen when a participant
takes command?** — a curriculum question, and in a seminar a comparability
question, since a cohort whose rosters were conditioned by their own first
matches cannot be compared to each other.

## Decision

### 1. A relationship account has prior strength

The ability observation counter starts from a **prior strength** `n₀ > 0` rather
than from zero:

```ts
const n = observationCount + priorStrength;      // priorStrength ≥ 1
const step = Math.trunc(ENGINE_CONFIG.ABIL_BAYES_NUMERATOR / n);
```

`n₀` states, in units the update already uses, how many observations the piece's
starting credence is worth. It is a property of the **relationship account**
(ADR 0035 channel 2), initialized when the account is opened, and it advances
with the account's observations.

The consequence is the intended one: a read still forms, and still forms from
the opposition's early moves as ADR 0013 requires, but it takes evidence
proportional to the confidence it displaces. A piece may conclude its commander
is incompetent inside one match — it must simply see more than one order to do
it.

### 2. Prior strength is not a floor, a decay, or a damper

`n₀` changes the **step size** of an update, never its direction, and never the
value of `τ_abil` in the absence of an observation. Nothing drifts toward a
baseline (ADR 0007), no update is clamped away from a conclusion the evidence
supports, and no cascade is damped (ADR 0011). A commander who is consistently
wrong arrives at the same `τ_abil` as before; it takes him longer, and the piece
that gets there has seen a case rather than an incident.

This is the whole of the mechanism. Rate-limiting `τ_abil` per match, flooring
it, or exempting the first match from observation are all rejected below.

### 3. A mechanics-only first game is not required

Nothing in the model needs the participant's first match to be
psychology-free, and making it so would teach the wrong lesson first: that
orders are executed because they are issued. Onboarding load is a UI and
curriculum concern — progressive disclosure of overlays, an advisor, a
facilitator's framing — and is not bought by suppressing the psychology.

### 4. No participant is required to win a first match

Requiring every seminar participant to win match 1 is rejected on three
independent grounds. It forces the first opponent to be an AI commander, which
contradicts ADR 0025's position that difficulty is an opposing *leader policy*
and either side may be human-led. It makes credence a function of a scripted
outcome, which is the thing ADR 0022 refuses for succession and should equally
refuse here. And it personalizes each roster by its own first match, so no two
participants in a cohort begin comparable — the measurement that ADR 0027 and
the transcript (ADR 0030) exist to support.

### 5. Pieces may observe a training record, and it buys patience only

A world (ADR 0029) may include a **training record**: a fixed, authored
sequence of observations attributed to a **training commander** — a distinct
`LeaderId`, not the participant — replayed into the log as ordinary
observations carrying a `TRAINING` provenance marker.

What it changes is bounded deliberately:

- It **raises the prior strength** `n₀` of the accounts the roster later opens.
- It does **not** raise `τ_abil` or `τ_benev` for the participant. Per ADR 0035
  a new commander's account still opens from disposition, and trust in *this*
  commander is still earned from *this* commander's conduct (ADR 0024: warmth
  is not required to win, and credence is not a compliance gate).

So a trained roster is **slower to condemn, not more obedient**. That is what
answers the owner's question about conditioning pieces "universally but not in a
way that personalizes them": the record is identical for every participant in a
cohort, is attributed to nobody in the cohort, and grants no participant
standing that another lacks.

### 6. The training record is data, uniform, and resettable

The record is content, not a code path (ADR 0023): it ships in a data pack, it
is identical for every participant in a world, and a facilitator resets it with
the world. Because it enters as ordinary marked observations, a debrief or audit
can fold over the log and separate what a piece learned in training from what it
learned under the participant, and replay verification covers it like any other
event. A world with no training record is a valid world; then `n₀` is whatever
opening an account from disposition gives.

## Consequences

**Every credence consumer that constructs an observation counter changes
shape.** `applyAbilityObservation` gains prior strength;
`src/orchestration/headlessMatch.ts`, `src/orchestration/matchSession.ts`, and
`src/orchestration/enemyTurn.ts` each track `abilityObservations` locally and
must source the account's strength rather than starting from 0.

**Prior strength must persist.** It belongs to the relationship account, so the
persistence and passport work that ADR 0035 already requires must carry it, and
a migration must choose a strength for accounts that predate this ADR.

ADR 0043 supersedes the symmetric `trunc(numerator / n)` step with an
integer-rational, asymmetric reducer. It retains the prior and persistent
counter but imposes a one-point floor and state-dependent gains/losses.

**Golden fingerprints move.** This changes the first few plies of every
campaign, so every golden anchor over match output is expected to change in the
commit that implements it, with the rationale recorded there.

**The calibration baseline is void.** `docs/calibration/` measurements taken
before this lands describe a model whose first observation saturated. Coefficient
selection must be redone afterwards; nothing should be chosen from the current
numbers.

**A new sensitivity probe is required.** Per rule 6 and the `ci-test-design`
skill, prior strength ships with a golden anchor and a probe asserting that
changing it changes the output — and, specifically, that the ply at which
`τ_abil` first saturates moves.

## Open questions

- **The value of `n₀`.** Deliberately not chosen here; it is a calibration
  decision to be made from campaign evidence, against the criterion that a
  weak opening is legible within a match but not within an order.
  **Owner: user.**
- **The size and content of the training record**, and whether a world may
  express it as a number of observations rather than authored ones.
  **Owner: user.**
- **Whether `τ_benev` needs the same treatment.** Its updates are event-shaped
  (heard, betrayal cliff, neglect erosion) rather than `1/n`-shaped, so it does
  not have this defect; whether it should nonetheless gain an evidential weight
  is not decided.

## Alternatives considered

- **Sweep `ABIL_BAYES_NUMERATOR` down.** Rejected: it rescales every update
  equally, so the first observation still dominates the second by the same
  ratio. It buys a slower model, not a model that requires evidence.
- **Cap `τ_abil` movement per match.** Rejected: a cap is a damper (ADR 0011) —
  it forbids a conclusion the evidence supports, and hides the saturation rather
  than removing its cause.
- **Exempt the first match from ability observation.** Rejected: pieces would be
  blind exactly when a participant is learning that orders have costs, and the
  exemption boundary would be visible and gameable.
- **Give a trained roster higher starting `τ_abil` for the participant.**
  Rejected: it hands over trust nobody earned, and it re-personalizes the
  roster, since the gift's size would have to depend on the participant's own
  training result.
- **Have the training record open the participant's account directly.**
  Rejected: it collapses the training commander into the participant and
  contradicts ADR 0035's per-commander accounts.
