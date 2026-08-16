# ADR 0054 — The seminar pool: how a commander gets pieces, what he may know, and what promotion means

- **Status:** direction **accepted** by the owner; the staging in §6 and every
  magnitude are **proposed**
- **Date:** 2026-08-19
- **Opens:** **D148** (what promotion means at campaign scale), **D149** (whether
  service can move ability), **D150** (what the player may know about a piece)
- **Implements:** ADR 0026 §2/§4/§5 (a community of pieces, free agency, the
  infrastructure ladder) for the roster-acquisition slice; carries **D70**
  forward and leaves **D72** open
- **Refines:** ADR 0048 (season-scarce pool), ADR 0051 (not being chosen),
  ADR 0018 (witness judgment and testimony), ADR 0053 (pawn hope)

## Context

Calibrating pawn promotion hope stalled on a question the coefficient could not
answer. At the knob's maximum no pawn is retained
(`docs/calibration/2026-08-18-pawn-hope-sweep.md`), and the reason is not the
ceiling: **promotion currently pays nothing**. `LivingBoard` records the
promotion (`src/chess/board.ts:367-369`), no orchestration path reads that
field, there is no `PROMOTION` event in the event union, `PieceState.role` is
never mutated, and the next match fields the same piece as a pawn.

The owner's question — *is a really great and loyal queen much better than a
mediocre and somewhat abused one, and is a promoted pawn therefore worth
pursuing across games?* — was measured
(`docs/calibration/2026-08-19-piece-quality-and-the-bench.md`). One piece's
carried history already changes the whole match. But the abuse channel is the
reliable one, `E_i` is a constant of role that nothing ever writes, and the
shipped application has **no bench at all**: `activeLineup` fields whoever is
`ACTIVE`, so benching a piece means playing a man down, and "free agents" are
the player's own deserters re-hired out of his own database
(`src/persistence/repository.ts:354-358`).

So the prior question is the owner's: *how does a commander get a roster of
pieces, and what can he know about them?* There is one chair per role on the
board — and then there is the bench.

> **"A seminar-wide pool with free agency: pieces circulate between commanders,
> can decline you, and a promotion is news across the whole cohort."**

## Decision

### 1. The pool, not the save file, owns the pieces
A piece belongs to the **cohort**, not to a commander. A commander holds a
**squad** — a set of pieces currently willing to serve him — drawn from and
returned to the shared pool. This is ADR 0026 §2 made concrete at the point where
a player actually touches it: the roster screen.

Nothing about the board changes. A fielded lineup is exactly the standard army
(`src/orchestration/headlessMatch.ts:429-433`), so there is exactly one queen's
chair. Scarcity is the point: the squad is deeper than the lineup, and choosing
who plays is a **move in the game**.

### 2. Acquisition is mutual and never assignment
A career begins by recruiting, not by being issued sixteen strangers. A piece
may **decline** — at career start, between matches, and permanently once
retired. Recruitment therefore reads a piece's own credence in that commander,
including credence formed by rumor and by having been on the receiving end of
his orders (ADR 0026 §3), which the two-channel model already expresses.

The consequence the design wants is that **a bad career ends with nobody taking
your calls**, not with a scripted dismissal. Its degeneracy detector is
ADR 0026's *captive labour*: if decline rate is ≈ 0 even for the worst policies,
free agency is nominal.

### 3. Single-player is whole, and AI commanders are permanent infrastructure
Offline, the cohort is populated entirely by AI commanders with real squads and
real histories (ADR 0026 §4, ADR 0047's world-persistent commanders). No
mechanic is lost without a network, and AI identities are never removed — a thin
market is the failure mode. The infrastructure ladder stands as ADR 0026 §5
recorded it: **passports first** (`src/persistence/passport.ts` already exports a
signed, digested piece), registry-shaped schema, no authoritative server. **D72
stays open**; nothing here decides it.

### 4. Promotion is a permanent change of class, and it is news
The board already knows. What is missing is everything after it:

- emit a `PROMOTION` event so witnesses, audits and debriefs can see it;
- mutate `PieceState.role`, preserving `PieceIdentity.originRole`, memories,
  trauma, bonds and name — the data model already specifies exactly this
  (`docs/data_model.md`, `src/chess/types.ts:9`);
- carry the mutated role through the campaign paths, which today re-derive role
  from the standard board and would silently un-promote her
  (`sim/roster.ts:109-135`);
- move **Pawn class prestige for every witness**, because a promotion is the one
  observable proof that the despised class can rise.

That last clause is the seminar-level effect the owner asked about, and its
magnitude and *sign* are deliberately left open in **D148**: "one of us made it"
and "she left us behind" are both coherent readings, and the second is the more
interesting one if the model can hold both.

Why this is monumental in this engine specifically: standing is
`mean over peers of max(0, (affinity + prestige)/200)` and `classPrestige` is
keyed by **role**. A pawn sits at −30 from other pawns, clipped to zero — nothing
to lose, which is precisely why pawns are the pieces that desert. Promotion is
the only way a living piece escapes class contempt.

### 5. Elevation must not be a trap by accident
Once role write-back lands, a promoted pawn leaves a bracket of eight and enters
one of **one**. She competes with the incumbent queen; the loser starts accruing
non-selection under ADR 0051, and the Pawn quota comes up short so
`conscriptMember` fields a stranger. That is a real and interesting cost — a
commander who promotes has to answer for it — but today it resolves by a field
nothing can change: `strongest_available` orders by `E_i` (`sim/pool.ts:250-254`),
so a promoted pawn keeps ability 20, loses every comparison, and is honoured into
permanent benching.

Elevation may be a gamble. It may not be a **foregone** conclusion decided by a
constant. Hence **D149**: either service moves `E_i`, or fielding priority must
stop being ability alone. Until one of those holds, promotion cannot be worth
pursuing across games and `DESERTION_PROMOTION_HOPE_PERMILLE` stays at `0`.

### 6. What the player may know (D150 — direction, magnitudes open)
ADR 0018 forbids showing the arithmetic; a shared market makes the *inverse*
failure just as bad, because a bench you cannot read is a bench you cannot use.
The proposed resolution is that **knowledge is earned, and it is testimony rather
than telemetry**:

| Channel | Shipped today | Proposed |
|---|---|---|
| Name and origin | stored, **rendered nowhere** | always visible; `originRole` visible, so "she was a pawn at Kerrow" is legible |
| Service record | not shown | visible, because it is a fold over the event log (matches, captures, refusals, desertions, commendations) |
| Trust, morale, trauma | non-numeric gauges, with exact integers leaking through `title`/`aria-label` (`src/ui/overlays/PieceOverlay.tsx:40-58`) | non-numeric only; the leak is a defect against ADR 0018 |
| Ability, traits | never shown | never shown as numbers; inferred from counsel and from what peers say |
| Bonds, prejudice, memories | never shown | surfaced as *testimony* — she says who she trusts, and may rationalize |
| A piece you have never served | n/a | rumor only, and rumor carries appraisals, never board facts (ADR 0016) |

A commander should be able to be **wrong** about a piece he has not led. That is
the scouting problem, and it is the thing that makes a market feel like a market.

## Consequences

**Staging.** Each slice is independently shippable and independently measurable;
later slices are worthless without the earlier ones.

| # | Slice | Why it is first |
|---|---|---|
| 1 | **Legible identity** — render names and `originRole`, service record from the log, remove the numeric leaks | no new mechanics; without it every later slice is invisible |
| 2 | **Promotion truth** — `PROMOTION` event, role write-back, campaign-path preservation, witnessed class movement | answers D148's mechanism half; unblocks the D147 calibration |
| 3 | **The squad** — a real player-commanded bench in the app: squad depth in persistence, the player picks the lineup, non-selection consequences already exist in `sim/` | makes the one-chair scarcity a decision instead of a constraint |
| 4 | **The market** — shared cohort pool, mutual recruitment with the right to decline, cross-commander trauma accumulating to retirement, passports as transport | delivers ADR 0026 §2/§4; needs all three detectors below |
| 5 | **Earned service** — whatever D149 resolves | last, because it re-ranges every desertion coefficient |

**New degeneracy detectors** (harness gates, in addition to ADR 0026's *free
commons*, *captive labour* and *thin market*):

- **Promotion is decoration.** Promotions occur but no promoted piece is ever
  fielded again, or Pawn prestige is unmoved in every witness.
- **The trap.** Promoted pieces' selection rate is ≈ 0 across a season, i.e.
  elevation is reliably worse for the piece than staying a pawn.
- **Frozen bench.** The same lineup is fielded every match under a policy meant
  to rotate, so squad depth is inert.

**Calibration is blocked in a defined way.** `DESERTION_PROMOTION_HOPE_PERMILLE`
and its credence floor keep their shipped values (`0` and `250`) until slice 2
lands; the hope ceiling stays at one peer bond, because the argument for raising
it was an in-match argument for a campaign-scale prize.

**Moderation and privacy** enter scope with slice 4 if it is ever networked, as
ADR 0026 §5 already records. Nothing in slices 1–4 requires a server.

## Alternatives considered

- **Exactly sixteen, and pieces change** — no bench; the army is fixed and all
  drama is who they become. Rejected by the owner. Cheapest by far, and it makes
  promotion a pure in-place transformation with no chair contest, but it removes
  the market that gives reputation teeth.
- **A private bench per commander, no market** — the harness's current model
  (`POOL_DEPTH_FACTOR: 2`) lifted into the app. Rejected as the destination, kept
  as slice 3 on the way there, because it is exactly the subset of the market
  that works offline.
- **Promotion earns a second queen on the board.** Physically unavailable: a
  lineup's IDs are installed onto `LivingBoard.standard()`. Recorded because it
  was mistakenly offered as an option.
- **Show the player everything.** Rejected: ADR 0018, and it would make scouting
  a lookup rather than a judgement.
