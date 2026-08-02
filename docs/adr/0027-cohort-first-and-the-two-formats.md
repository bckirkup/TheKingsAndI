# ADR 0027 — The cohort is the first community: seminar formats, Steam's actual job, and what gets built first

- **Status:** accepted
- **Resolves:** **D75** (the registry ships for the seminar before consumer),
  **D76** (two seminar formats and their pacing), **D77** (facilitator ratio),
  **D78** (what Steam is for, and the refund-window constraint), **D79** (build
  order: harness → debrief artifact → playable)
- **Refines:** D72 (infrastructure tier), D13 (distribution), D1 (first
  audience), D26 (matches before collapse), ADR 0023, ADR 0026

## Context

> **"What gets built and tested first... what Steam does for us, and how this
> works in a leadership seminar vs a recreational mode... a campaign in a week
> with six games a day for four days... alternatively a 13-week cycle with
> three-four games per week, a grueling 52-game Nibelungen cycle."**

ADR 0026 left D72 open: which infrastructure tier hosts the community. The
seminar answers it.

## Decision

### 1. A cohort *is* the community — so the registry ships for enterprise first (D75)
Twelve to twenty-four people, one room, one week, one facilitator install:

| Registry cost (ADR 0026 tier 2) | In a cohort |
|---|---|
| Identity and accounts | enrollment |
| Moderation | a facilitator and a code of conduct |
| Privacy | consented participants |
| Cold start | AI commanders (D74) plus a known roster |
| Discovery | a scheduled course |

Every reason tier 2 looked expensive for a consumer launch disappears. **The
registry therefore ships first for the seminar; consumer distribution stays on
tier-1 passports** — the reverse of ADR 0026's provisional recommendation, and
strictly lower risk, because the shared world is proven in a controlled room
before it is exposed publicly.

The pedagogy improves as a side effect: students play *each other*, pieces
circulate through the cohort, and the trauma pool is shared.

> The pieces you burned on Monday are the ones your colleague inherits on
> Wednesday.

The organizational lesson is delivered by the mechanic rather than by a slide.

### 2. Two formats, teaching different halves (D76)

| Format | Matches | Covers | Sold as |
|---|---|---|---|
| **Intensive** — 4 days + half-day indoc + half-day debrief | ~24 | roughly **one act**: learn it is not chess, be dismissed or nearly so, be debriefed | a **diagnostic** |
| **Nibelungen** — 13 weeks × 3–4 | ~52 | the full three-king career: failure, diminished second command, rebuild | the **behaviour-change** product |

The intensive cannot teach recovery, because recovery requires a second
appointment with a reputation attached (ADR 0024 §4–5). That is a scope
statement, not a defect.

**Pacing: four matches a day plus a structured midday debrief beats six.** Six
games is 4–6 hours of play and leaves nothing for reflection, and the spiral
needs *between-match* thinking to land. Campaign length survives the cut because
the trap wants roughly 8–12 matches to close (D26), not 24.

### 3. Facilitator ratio is bounded by debrief, not supervision (D77)
Play is deterministic and fully audited (ADR 0018), so nobody needs to be watched
playing — the audit is the record. One facilitator runs **~12** with individual
debriefs, or **~24** in plenary with a cohort dashboard whose material is the
cross-student piece flow.

### 4. What Steam is actually for — and the refund window (D78)
Steam provides discovery, payments, and a self-funding stream of **calibration
data from players who do not want a lesson** and will therefore break the model
in ways executives never will. It provides **nothing** to the seminar track,
which wants a browser or a facilitator install rather than a store client.

It also imposes one specific hazard that must be designed for now:

> **Steam's two-hour refund window versus a first act designed to be lost.**

If the hook lands at match eight, a substantial fraction of buyers refund at
match three having concluded the chess AI is stupid. **The consumer build needs a
compelling first ninety minutes that the seminar build does not** — a pacing
decision, not a different game. Candidates: an earlier first refusal, a
first-match testimony that makes the mechanic legible, or a shortened act one.

### 5. Build order: harness → debrief artifact → playable (D79)
"Offline-first" was really the question of what gets built and tested first.

1. **Headless harness.** The central risk is whether the psychology is
   interesting and non-degenerate; that is answered by simulation, not by
   players, and needs no UI.
2. **The debrief artifact.** AI-versus-AI matches produce real audits, and an
   audit is a **sellable deliverable with no game attached** — the earliest point
   at which someone other than the team can validate the project.
3. **A single playable act**, then the rest.

## Consequences

**The enterprise track is now the first shipping target of the shared world**,
which touches D1 (first audience): consumer remains the first *playable*, but the
seminar is the first *community*.

**New degeneracy detector — the ninety-minute cliff.** Under a consumer pacing
profile, if nothing legible about the leadership mechanic occurs inside the first
ninety minutes of play, the refund risk is real and the pacing has failed (D78).

**New degeneracy detector — cohort collapse.** In a simulated cohort, if
cross-student piece flow does not measurably transmit consequences between
students, the seminar's central claim is decorative (D75).

**Facilitator tooling becomes a Milestone-5 deliverable**, not a Milestone-7
polish item: cohort dashboard, per-student audit export, roster circulation view.

**D26 gains a constraint.** Whatever number of matches the trap needs, it must
fit inside ~16–20 played matches of an intensive week, or the intensive format
cannot deliver its diagnostic.

## Alternatives considered
- **Consumer registry first.** Rejected: moderation, privacy, and cold start are
  all worse in public, and none of them are needed to prove the mechanic.
- **Six matches a day.** Rejected: it buys matches by spending the reflection the
  design depends on.
- **UI first.** Rejected: a beautiful board with a 0% or 90% desertion rate is
  worth nothing, and the audit alone can be sold.
- **Skipping Steam.** Rejected: the calibration data and the self-funding are
  real, and hostile players are the best possible test of a psychology model.
