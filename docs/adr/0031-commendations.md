# ADR 0031 — Commendations: celebrating performance without judging the person

- **Status:** accepted
- **Resolves:** **D91** (the commendation set), **D92** (non-domination),
  **D93** (criteria hidden during play, revealed at debrief), **D94** (the
  facilitator's parallel set)
- **Refines:** ADR 0030 (transcript), ADR 0028 §3 (facilitator audit),
  ADR 0024 (second acts)

## Context

> **"There are several categories of achievement that people would rightly be
> interested in having celebrated at the end of a seminar (and several that a
> facilitator should be steered toward). You are certainly highlighting one —
> evenness of attention. Getting the best out of the best, keeping the worst
> from drowning, overcoming weaknesses, grit and endurance, overall
> improvement."**

The transcript (ADR 0030) diagnoses. A seminar also has to **celebrate**, and it
must do so without asserting anything about the person (D90).

## Decision

### 1. The commendation set must be non-dominating (D92)
No player may hold all commendations, because the good ones **trade off**:
extracting the most from your strongest pieces competes for attention and tempo
with keeping the weakest from drowning. If a single player can sweep, the awards
have collapsed into one score and the design has re-created the failure ADR 0022
§5 and ADR 0019 both guard against.

Non-domination is a **tested property**, not an aspiration.

### 2. The player's commendations (D91)
Each is a fold over the event log and is stated as performance, never as
disposition.

| Commendation | Measure |
|---|---|
| **Evenness of attention** | Gini over *consultation and use* — who was never asked, never defended, never fielded — not only over trauma |
| **The best of the best** | top-quartile pieces' realized play against their own ceiling; stars underperform under bad leadership, and a win/loss record hides it |
| **Nobody drowned** | bottom quartile: no retirements, and the lowest-credence piece never reached the floor |
| **Overcoming a weakness** | largest recovery in a piece that began traumatized or class-prejudiced against the player; separately, the player's own weaker credence channel improving |
| **Grit and endurance** | sound policy sustained *through* a losing streak — precisely where ADR 0024 says cold leaders come apart, so it discriminates rather than participates |
| **Overall improvement** | the learning delta (ADR 0030 §4) |
| **The honest sacrifice** | a piece spent for a genuine win whose trust survived it — requiring explanation before and an answer after |
| **The repaired breach** | a relationship restored after a real betrayal event; the hardest thing in the model to achieve deliberately |

**"Nobody drowned" is the one facilitators should steer hardest toward**: it is
the least intuitive to players and the most transferable off the board.

### 3. Criteria are computed at debrief, not shown during play (D93)
The Goodhart problem is fatal here.

> The moment a student can watch an *evenness* meter, evenness stops being
> leadership and becomes the game.

Facilitators may see commendation state live, since steering is their job.
Students see it after. This is a hard rule, not a default.

### 4. The facilitator's parallel set (D94)
Same instrument, one rung up (ADR 0028 §3):

- **Even distribution of hard seeds** across students.
- **Growth of the weakest student**, not the average.
- **Pairing quality** — whether matchups produced learning or humiliation.
- **Even expenditure of the cohort's people**, the facilitator-scale analogue of
  evenness of attention.

## Consequences

**New degeneracy detector — dominating strategy.** Any leader policy that earns
substantially all commendations across seeds. Non-domination must hold in the
harness, and the oracle policies (`pure_tactician`, `cold_winner`, rebuilder)
should each win a *different* subset.

**New degeneracy detector — commendation leakage.** Any commendation state
visible to a student during play, including implicitly through UI ordering,
prose, or hint text (D93).

**New degeneracy detector — unwinnable award.** A commendation no policy ever
earns across the harness, or one every policy earns; both are dead content.

**Copy discipline inherits D90.** Commendation names and text describe what was
done. "Nobody drowned" is an outcome; "compassionate leader" is a trait and is
banned.

**Award count is a calibration knob.** Too many and the ceremony is meaningless;
too few and the tension between them disappears.

## Alternatives considered
- **A single "best leader" award.** Rejected: it collapses the channels and the
  columns and teaches that one style wins.
- **Live progress toward commendations.** Rejected: it converts leadership into
  metric farming, which the trust-farming detector already shows the model is
  vulnerable to.
- **Awards for outcomes only (wins, material).** Rejected: outcomes are
  seed-noisy and are exactly what the counterfactual exists to contextualise.
