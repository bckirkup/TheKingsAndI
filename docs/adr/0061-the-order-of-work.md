# ADR 0061 — The order of work: scarcity, then instruments, then the economy, then the honours

- **Status:** Proposed. The *order* is owner-directed; every magnitude named
  downstream stays where its own ADR left it
- **Date:** 2026-08-20
- **Scope:** Sequencing, integration and test strategy for ADR 0059 (the draft)
  and ADR 0060 (the scoreboard and the honours)
- **Supersedes:** ADR 0054 §6 staging (slices 1–3 shipped; its slice 4/5 ordering
  predates the draft and the honours and no longer describes the work)
- **Opens:** nothing. It resolves no decision; it says in what order the open
  ones (**D148**, **D153**–**D158**) come due
- **Refines:** ADR 0031 (commendations), ADR 0026 (the community of pieces)

## Context

Slices 1–3 of ADR 0054 shipped, and then the design grew a market, a purse that
runs backwards, and four kinds of honour. The remaining work is no longer a list
of features; it is a **chain of measurements**, and the failure mode is now
ordering rather than difficulty.

The history in this repository is unambiguous about why. Every calibration
before `2026-08-18` was run against an opponent who could not punish us, so nine
leader styles measured as the same degenerate run and every adopted coefficient
had to be re-baselined. The roster emptied by match 1 for weeks and no
instrument said so. The lesson is not "measure more": it is that **a step whose
instrument does not yet exist produces a confident number that has to be thrown
away**, and every step built on top of it goes with it.

So the ordering rule for the rest of this project is:

> A step may not ship before the instrument that would detect its failure.

## Decision

### 1. The order

| # | Step | Gate it opens | Why it cannot move later |
|---|---|---|---|
| 1 | **Scarcity** — the green levy replaces free conscription; the stock becomes one legal army plus reserve (ADR 0059 §1–§2) | D153 | Today a chair that cannot be filled invents a stranger — unlimited, instant, free, at role baseline (`src/app/squadCareer.ts:282-345`). Every price, bid and acceptance discount downstream is arithmetic over an infinite pool until this changes. It is also the smallest change in the plan |
| 2 | **Instruments** — the public register fold, the orthogonality probe, the award-liveness detector, and the three commendation fidelity defects | D157 partly | Three folds key off `initialRoster` and one reads only the final `rosterEnd` (`src/persistence/commendations.ts:108-214`). Those are *latent* today and become **wrong answers** the moment step 3 lets a roster change between cycles. Fixing them after the draft makes every draft measurement suspect |
| 3 | **The draft** — public slate, private biased counsel, reverse-order purse and priority (ADR 0059 §3–§7) | D154, D155 | The load-bearing step, and the only one that needs both of the above underneath it |
| 4 | **The between-cycle market** — free agency, the acceptance discount, and the history-shaded first-encounter prior | D150, and the trauma-spillover question | Recovery from a bad start is what makes the campaign not a foregone conclusion, and it can only be measured once a draft has produced good and bad starts |
| 5 | **The honours** — settlement and disclosure machinery first, then the catalogue (ADR 0060 §2, §6) | D157, D158 | Settlement is a computation over the log; the catalogue is content. Writing flavour before the orthogonality probe exists means writing awards we cannot tell apart from the scoreboard |
| 6 | **Postings and demotion** — TDY, desirable and undesirable, and demotion (ADR 0059 §8) | D156 | Blocked on **D148** regardless of anything here |
| 7 | **The parameter search** over the whole cycle (ADR 0059 §9), and only then the GUI | D153–D158 magnitudes | The search space is not closed until every knob above exists; and the owner's standing rule is that no GUI work precedes a simulation that is broadly built and sensibly balanced |

Steps 1–2 are independent of each other and could be done in either order; 3
requires both; 4 requires 3; 5 requires 2; 6 requires D148. Nothing in the chain
is parallel *across* steps, which is the whole point of writing it down.

### 2. Integration: every step ships wired at zero

Each step lands as a merged, shipped code path whose **behaviour is bit-identical
to the previous head** until a magnitude is approved — the pattern that worked
for promotion hope, earned ability and the credence channels: wire it, prove the
harness output is unchanged, measure the knob, bring the number for approval,
then adopt it in a second change with the calibration record attached.

This keeps two things separable that are easy to conflate: *does the mechanism
exist and is it plumbed*, and *is this magnitude the fun one*. A step that
answers both at once cannot be reverted on the second question alone.

Harness first, then the shipped app path, and the two must agree — the chair
contest moved into shipped orchestration bit-identically for exactly this reason,
and the same discipline applies to the levy, the purse and the register.

### 3. Testing: the detector precedes the magnitude

For every step above:

- a **wiring probe** per new config key, as AGENTS.md already requires — a
  parsed-but-unwired knob is a review failure;
- a **graded sensitivity** test rather than a golden where the surface is still
  moving, per the `ci-test-design` skill: a few different values here produce a
  few different values there;
- the step's **degeneracy detector added in the same change as the knob it
  guards**, not after the first bad calibration. The detectors ADR 0059 §9 and
  ADR 0060's consequences section already names — purse runaway, tanking
  dominance, price collapse,
  informant sycophancy, register mirroring, guild capture, trophy feedback,
  cycle-one unplayability — are each attached to a step in the table above and
  ship with it.

A detector written after the failure it describes has already cost a
re-baseline; every detector in this project so far was written that way, and the
trap detector had to be rewritten relative to a control because at the threshold
first chosen it would have stayed silent through the entire defect it exists to
catch.

### 4. What may be parallelised, and what may not

The chain is serial because each step's approved default is an input to the
next, and because the calibration artifacts accumulate in one workspace. Fanning
the *chain* out across sessions produces several confident answers measured
against different baselines — the failure the 08-18 re-baseline already paid for
once.

Two batches are genuinely independent and fan out cleanly, because each item is
a separate fold with no shared state and no magnitude to approve:

- the commendation fidelity defects in step 2 (one fold each);
- the guild-award criteria in step 5 (one fold over the move log each).

Everything else is one owner, one baseline, one workspace.

## Consequences

- ADR 0054 §6's slice table is historical from slice 4 onward; this document is
  the live plan.
- **D148 is now on the critical path for step 6 only.** It does not block the
  draft, the market or the honours, which is why demotion sits last.
- The three commendation defects become a *prerequisite* rather than a cleanup,
  and they are the one place in the plan where a bug fix is load-bearing for a
  feature.
- Step 5 deliberately ships the disclosure machinery before any new award text,
  so the catalogue can be invented — including the humorous ones — against a
  probe that says whether each new honour measures anything the register does
  not.
- The GUI stays out of scope throughout, per the standing owner rule.

## Alternatives considered

- **Draft first, instruments after.** Fastest to something demonstrable and it
  is what the momentum of the design wants. Rejected: the commendation folds
  silently mis-measure any roster that changed between cycles, so the draft's own
  calibration would be the first casualty.
- **Honours first**, since they are the terminal accounting and the most fun to
  write. Rejected: without the register fold and the orthogonality probe there is
  no way to tell a new honour from a re-skin of the scoreboard, and the catalogue
  is the part hardest to unwrite once a cohort has seen it.
- **One large change containing the draft, the market and the honours.** Rejected
  on the same ground as always in this repository: a balance change that cannot
  be bisected cannot be calibrated, and the ADR 0059 §9 search needs each knob to
  have arrived with its own before/after.
- **Fan the chain out across child sessions.** Rejected in §4.
