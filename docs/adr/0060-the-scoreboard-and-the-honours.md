# ADR 0060 — The scoreboard is the trap: what is disclosed, when, and what a piece can see

- **Status:** Proposed. The shape is owner-directed; disclosure depth per cycle
  and the salience weights are **open** and belong to the parameter search
  (ADR 0059 §9)
- **Date:** 2026-08-20
- **Scope:** Commendation disclosure, the public register, piece observation of
  the commander's record
- **Opens:** **D157** (what is disclosed and when), **D158** (what a piece
  observes of her commander's record)
- **Refines:** ADR 0031 §3 (D93 — criteria computed at debrief, not shown during
  play), which this ADR keeps and makes precise
- **Related:** ADR 0016 (rumor carries appraisals, never board facts), ADR 0018
  (no arithmetic on show), ADR 0030 (transcript and learning delta), ADR 0050
  (heroism nomination), ADR 0059 (the draft and the purse)

## Context

> **"Awards that are known in advance should be obvious and at some level
> deceptive. Who wins the most, by how many points... that kind of thing. A
> leaderboard that every leader keeps in the back of mind subconsciously if it
> isn't provided explicitly."**
>
> **"The real question is when to start disclosing some of the less obvious
> ones."**

D93 settled that commendation criteria are computed at debrief and not shown
during play, on the Goodhart argument: *the moment a student can watch an
evenness meter, evenness stops being leadership and becomes the game.* That
remains right, and it under-specifies three different things which this ADR
separates:

- the **charter** — that an award exists at all, and what conduct it honours;
- the **standing** — where you are against it right now;
- the **verdict** — whether you won it.

D93 forbids publishing the *standing*. It does not follow that every charter
must be secret, nor that the public surface should be empty — and an empty
public surface is a fiction anyway, because a leader keeps a scoreboard in his
head whether or not we print one.

## Decision

### 1. The public register is the crude one, and it is the trap (D157)

What is disclosed in advance, continuously, to everyone, is the **obvious**
record: wins and losses, margin, material taken and lost, promotions reached,
current streak, and the cohort rank those imply. Nothing here is secret, nothing
here is a psychological quantity (ADR 0018), and all of it is a fold over the
public event log.

It is disclosed **because** it is the leaderboard a commander is already
keeping, and printing it makes the deception legible rather than accidental:

- every fact on it is true;
- the ranking it implies — that the commander at the top is the best commander —
  is **not**, and the debrief is where that is answered;
- chasing it actively costs the sealed honours, which measure what the register
  cannot see: who was never asked, who was kept from drowning, who was rebuilt.

This is deception by *emphasis*, not by falsehood, and it is the same deception
the world performs on a real manager. It also has teeth rather than being
scenery: the register is what sets **reverse-order draft priority** (ADR 0059
§2), so leading it costs purse next cycle. The visible scoreboard is
simultaneously the status object and the handicap.

### 2. The honours stay sealed within a cycle, and settlement is the trigger

No sealed award publishes a standing during play — D93 unchanged. The new rule
is *when* a charter or verdict may open:

- **On settlement.** An award may be disclosed the moment its verdict can no
  longer be changed by anything left to play. Disclosure then cannot distort
  behaviour, because there is no behaviour left to distort.
- **Asymmetrically.** A settled **won** honour may be shown; a settled **lost**
  one waits for the debrief. Announcing a loss mid-cycle licenses a commander to
  abandon the piece the award existed to protect, which is the exact failure the
  award is measuring.
- **Never by schedule.** "Reveal at match 5" is farmable in matches 1–4.

### 3. The cross-cycle clock belongs to the facilitator, not the student

> **"The facilitator should mostly have experienced cycles before... there might
> be commendations that are not disclosed at all in a cycle where they aren't
> given... all other participants only go through this once, typically."**

A student sees **one** cycle. So there is no "how much is open by cycle 3" to
tune for him: the charter he ends with is whatever his debrief reveals, and the
asymmetry is structural rather than scheduled — the facilitator has been round
before and holds the full charter; the cohort does not.

**An award nobody earned is never mentioned.** The honours read at debrief are
the honours *given*. A student never learns what he missed, which is what keeps
an unearned award unfarmable in perpetuity rather than only until the first
debrief, and it removes the consolation-prize reading of a list of empty rows.

Two consequences follow.

- ADR 0031's **unwinnable-award detector** loses its player-visible symptom
  entirely: an award no policy ever earns now looks identical, from inside a
  seminar, to an award that is merely hard. It can only be caught in the harness,
  so that detector becomes load-bearing rather than a nicety.
- A **facilitator may unseal one award deliberately** for a cohort. Steering is
  their job and D93 already grants them live sight; what this adds is that
  unsealing is a recorded, deliberate act with a cost — the unsealed award
  becomes farmable and must be read as instruction rather than as measurement
  thereafter.

### 3a. The consumer campaign has no facilitator, so it needs a different default

In the seminar the asymmetry is held by a person. In the consumer campaign the
player *is* the returning veteran: he plays cycle after cycle, so the charter
leaks to him by repetition no matter what we do, and by cycle three he knows the
full set. The two products therefore want different disclosure defaults — and
the consumer one has to survive a player who knows every charter, which is the
harder test and the one the harness should be pointed at.

Recorded, not decided: whether the consumer campaign leans into that (open
charter, difficulty carried by the awards genuinely trading off against each
other, per ADR 0031 §1) or rotates which honours are live per cycle.

### 4. Some honours are never heralded at all

Awards for conduct nobody could pursue on purpose stay unannounced even to
veterans — `repaired_breach` is the type case, which ADR 0031 already calls the
hardest thing in the model to achieve deliberately. Publishing its charter
converts it into a instruction to betray a piece early so as to repair it later.

### 5. What a piece sees (D158)

A piece never observes an award, a standing, or a criterion. She observes the
**public record and the conduct**: results, who was fielded and who sat, who was
promoted, who was captured, who was spent, who walked. Then she attends to a
*subset* weighted by what makes a thing salient to her — her class prejudice for
the roles involved, her dyadic affinity for the pieces involved, and what she
personally witnessed. Rumor continues to carry appraisals only, never board
facts (ADR 0016).

The consequence is the one that matters for ADR 0059's market: **acceptance is
priced off reputation as pieces perceive it, not off the true record.** A
commander who wins by expending pawns is cheap to the officers who never noticed
and expensive to the pawns who did.

Piece-level honours are a different kind and remain observable — a heroism
nomination (ADR 0050) is a witnessed event about a piece. Commander
commendations are for the humans at the table. Pieces respond to conduct, never
to honours; otherwise an honour becomes a currency and trust-farming reopens.

## Consequences

**The awards must stay alive to the last match, and today several do not.**
Settlement-triggered disclosure makes liveness a first-class property, and the
shipped folds show three concrete failures:

- `nobody_drowned` returns `0` as soon as any retirement is present, so one
  retirement in match 2 settles it — lost — for the whole cycle
  (`src/persistence/commendations.ts:129-137`). It also reads only the **final**
  match's `rosterEnd`, so a piece retired and dropped from the roster earlier may
  not be counted at all: a fidelity gap to re-specify, not a disclosure question.
- `best_of_the_best`, `overcoming_a_weakness`, and `repaired_breach` all key off
  `initialRoster(matches)` (`commendations.ts:108-123`, `139-153`, `194-214`).
  Under ADR 0059 a roster changes between cycles by draft and recruitment, so a
  drafted or recruited piece is **structurally ineligible** to trigger three of
  the eight awards. That must be re-specified with the draft.
- `honest_sacrifice` requires `match.result === 'WIN'`
  (`commendations.ts:178-192`) and `grit_and_endurance` requires a losing streak
  (`commendations.ts:155-176`). These are already the anti-tanking and
  recovery-honouring pair ADR 0059 §3 asks for: a commander who throws matches
  forfeits one and a commander who is genuinely losing can still earn the other.

**New degeneracy detectors.**

- **Dead-by-match-two.** Any award whose verdict is settled before the final
  third of the cycle in most seeds is dead content for the rest of it.
- **Charter leakage.** `commendationLabelsForLeakageScan`
  (`commendations.ts:332-334`) scans labels; it must extend to sealed *criteria*
  appearing in prose, hint text, or UI ordering, which is the leak D93 actually
  fears.
- **Omniscient salience.** If a piece's perceived reputation correlates almost
  perfectly with the true record, §5's salience filter is decoration and the
  market's acceptance price carries no information — the same failure as ADR
  0059's informant sycophancy detector.
- **Register capture.** If the policy that tops the public register also takes
  most sealed honours, the register is not a trap and ADR 0031's non-domination
  property has failed.

**Open, and belonging to the search:** charter depth per cycle, salience weights
for class versus bond versus witness, whether the register shows cohort rank or
only own record, and whether settled-won disclosure happens at all or is simply
deferred to debrief for uniformity.

## Alternatives considered

- **Keep everything dark until debrief, including the register.** The status quo
  reading of D93, and rejected: it does not remove the leaderboard, it only
  removes *our* copy of it, and a fabricated one in the commander's head is
  worse because it cannot be answered at debrief.
- **Progress bars on the sealed awards.** Rejected by ADR 0031 §3 and by the
  trust-farming detector; this is the metric-farming failure in its purest form.
- **A scheduled reveal (e.g. after match 5).** Rejected: farmable in every match
  before the schedule fires, which is most of the cycle.
- **Let pieces read commendations.** Rejected: it makes an honour a currency and
  reopens trust farming from the other side.
- **Publish the sealed criteria and rely on them being hard to farm.** Rejected
  for the proxy awards specifically: `evenness_of_attention` is farmable by
  mechanical rotation, which produces the metric while destroying the conduct.
