# ADR 0030 — The transcript: proof of performance, evidence of learning

- **Status:** accepted
- **Resolves:** **D86** (the transcript, not the certificate, is the artifact),
  **D87** (the metric set), **D88** (counterfactual benchmarking and peer
  norming), **D89** (learning delta as the headline metric), **D90** (validity
  discipline — behaviour, never traits)
- **Refines:** ADR 0018 (audit), ADR 0022 (two columns), ADR 0024 (second acts),
  ADR 0029 (what leaves the world)

## Context

> **"A facilitator can print a certificate, that's lovely and all. 'Played the
> Game.' But this entire system has better metrics that can make it proof of
> performance and evidence of learning. A report card, a transcript."**

ADR 0029 made the certificate evidence-backed. It is still a receipt. The system
records every order, refusal, override, concession, and casualty, and — uniquely
— can **re-run** any of it.

## Decision

### 1. The transcript is the artifact; the certificate is its cover page (D86)

### 2. The behavioural record (D87)
Everything below is a fold over the event log (ADR 0018), never a separately
maintained counter:

| Metric | What it shows |
|---|---|
| **Board quality vs. execution fidelity** | the merit of orders issued against the share actually carried out; the *gap* is the finding (ADR 0022 §5) |
| **Channel trajectories** | `τ_abil` vs `τ_benev` over time — "they thought I was wrong" vs "they thought I didn't care," which demand opposite corrections |
| **Override ledger** | how often coercion was used, its price, and what followed |
| **Concession quality** | withdrawing a genuinely good move is a concession; withdrawing a bad one is theatre. The trust-farming detector (ADR 0019) doubles as a listening metric |
| **Distribution of harm** | not only how many pieces were burned but whether burnout was concentrated or spread — a Gini coefficient over trauma |
| **Attrition** | desertions, refusals sustained, retirements attributable within the world (ADR 0029) |

### 3. Counterfactual benchmarking and peer norming (D88)
Two things only determinism affords, and they are what make this a transcript
rather than a report:

**Counterfactual.** Seeds and logs replay exactly, so the player's own positions
can be re-run under oracle policies — `pure_tactician`, `cold_winner`, patient
rebuilder — and the transcript reports what was *achievable on the boards he
faced*:

> Not "you lost six," but "on those positions the pure tactician also lost six
> and the rebuilder lost three."

That converts a score into a diagnosis.

**Peer norming.** A cohort can be dealt identical seeds, so student comparisons
are on the same positions with the same rosters. Rare in any assessment
instrument, and free here.

### 4. The learning delta is the headline enterprise metric (D89)
Act one diagnoses. Act two — diminished command, reputation attached (ADR 0024
§4) — is where a **change in policy** can be measured: override rate, concession
quality, whether the second roster's benevolence channel recovers, whether the
execution-fidelity column moves independently of board quality.

That is evidence of learning in a sense a post-course survey cannot reach, and it
is the reason the thirteen-week format is the behaviour-change product while the
four-day format is a diagnostic (ADR 0027 §2).

### 5. Validity discipline: behaviour in simulation, never traits (D90)
```
DEFENSIBLE   "Overrode 34% of refusals; 71% of those came after a loss."
NOT EARNED   "Low empathy."
```
The transcript reports what was done in a simulation. Trait inference,
psychometric scoring, and predictive claims about job performance are **out of
scope** until a validation study exists, and no shipped copy may imply them.

### 6. Same instrument one rung up
The facilitator's transcript (ADR 0028 §3) uses this structure aimed at pairing
decisions, interventions, and how evenly the cohort's people were spent.

## Consequences

**The transcript is a Milestone-5 deliverable** and, per ADR 0027 §5, the
*debrief artifact* is the earliest sellable thing in the project — so the metric
set above must be computable from AI-versus-AI logs before any UI exists.

**Counterfactual runs are a cost.** Re-running each match under *k* oracle
policies multiplies simulation time by *k*; it happens offline at world end, not
during play.

**New degeneracy detector — flattering counterfactual.** Oracle policies that
never outperform the player on his own seeds, making the benchmark vacuous.

**New degeneracy detector — metric collinearity.** Transcript metrics that
correlate so strongly they carry one signal in six columns (the ADR 0022 §5
column-collapse problem, generalised).

**New degeneracy detector — trait leakage.** Any shipped string in a transcript
or certificate that asserts a disposition rather than a behaviour (D90).

**New degeneracy detector — unmeasurable learning.** A player who demonstrably
changes policy between acts and whose learning delta does not move.

## Alternatives considered
- **Certificate only.** Rejected by the owner, correctly: it proves attendance.
- **A single leadership score.** Rejected: it re-collapses the two channels and
  the two columns, which are the whole diagnostic.
- **Trait/psychometric profiling.** Rejected: unearned, and it invites a validity
  challenge the project cannot yet answer.
- **Outcome-only grading.** Rejected: outcomes are seed-noisy; the counterfactual
  exists precisely to separate result from conduct.
