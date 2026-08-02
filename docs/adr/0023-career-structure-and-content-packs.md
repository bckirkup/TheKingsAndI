# ADR 0023 — The career is the unit of play: three kings, a laundering-proof bench, and role-abstract content packs

- **Status:** accepted (owner ruling, 2026-07-27)
- **Resolves:** **D57** (career structure), **D58** (bench depth and reputation
  transfer), **D59** (career victory condition), **D52** (situation-key schema),
  **D53** (content packs vs. code paths)
- **Refines:** ADR 0007 (spiral), ADR 0009 (roster), ADR 0021 (mandate),
  ADR 0022 (succession)

## Context

> **"Do you start with three kings and your career might have up to three acts
> (once none of them are willing to start a game with you, it is time to kill
> the account...)? Or one? What is the ultimate purpose of the campaign... and
> that gets to your question about themes and schema."**

ADR 0022 made dismissal survivable for the roster and terminal for the player's
authority. That leaves the scale of the whole exercise undefined: how many
commanders' worth of failure a save file contains, how many identities the
player draws from, and what a career is *for*.

## Decision

### 1. Three kings, three acts — and the player is the only mortal thing (D57)
A career contains up to three appointments. Each dismissal burns a king; when no
king will start a match with the player, the career ends.

The symmetry is the point: capture is not permadeath for a piece (ADR 0009), and
desertion is not permadeath for a piece — but dismissal *is* permadeath for the
player. **The roster outlives its commanders**, which is what the plural in
*The Kings and I* has meant all along.

A career, not a match or a campaign, is therefore the unit of play, the unit of
persistence, and the unit the debrief summarizes.

### 2. Reputation transfers, so the bench cannot launder trust (D58)
The exploit that decides bench depth: with a deep bench, a leader who burns his
roster simply recruits strangers who have not yet learned to distrust him, and
trust stops mattering because it is always replaceable.

**Therefore a new recruit is never naive.** On joining, a piece is seeded with:

```
τ_abil(recruit → leader)   ← the leader's record (win/loss, vindicated orders)
τ_benev(recruit → leader)  ← the roster's current appraisal, via the rumor channel
```

Both scalars are already carried by rumor (ADR 0016), so this costs no new
machinery. With reputation transfer, bench depth is a comfort rather than an
escape, and **~32 identities** is a safe cap. Without it, any bench deeper than a
few spares breaks the game.

The same mechanism gives the three acts a difficulty curve for free: **king two
has heard about you.** No artificial scaling; the second act is harder because
the player has a past.

### 3. A career is won when the army exceeds the player's ceiling (D59)
Winning matches is how a player knows he is not failing. It is not what a career
is *for*.

ADR 0022 §5 already scores **board quality** (how good the orders were) against
**execution fidelity** (how many of them happened). Losing command is what
happens when good orders do not reach the board. The career victory condition is
the sustained inverse:

> The army's realized play exceeds the player's own tactical ceiling — measured
> as realized position quality above `V_own(player)` maintained across matches.

Leadership is when the organization outperforms the leader. That is one number,
it is computed from data already in the event log, and it states the thesis
without narrating it.

### 4. Situation keys are role-abstract; content is data (D52, D53)
If the exec-lab track is the same simulation with different nouns, then **a
situation key must never mention chess**:

```
BAD   : "pawn_refused_diagonal_advance_after_capture"
GOOD  : "subordinate.refused.high_risk_order.after_betrayal_by_this_leader"
```

Keys name relationships and events — actor role class, event, precondition — and
never board objects or geometry. A content pack is then data:

```
ContentPack = {
  themeTokens,        // color, typography, audio
  nounMap,            // Pawn -> Analyst, King -> Board Chair, capture -> ...
  dialogue,           // bound to situation keys, coverage-validated
  epilogues           // per terminal state and per act
}
```

**D53 resolves to data packs**, because the enterprise track is the same
simulation with different nouns; a code-path fork would be a second codebase
maintained forever. **D52 resolves to role-abstract keys** carrying the two
credence channels separately (ADR 0019), so a piece can say *"I know it was
right, I just don't think you care"* in any skin.

### 5. Ship one act; put three in the schema
Three acts triple the authored content, and content is what gets cut when a date
arrives. Day one requires only `CareerId`, `ActId`/`KingId`, and reputation
transfer between acts — cheap now, a migration later. The shipped MVP may run a
single act.

## Consequences

**Longevity comes from the generator, not the author.** What sustains a game for
years is content the system produces. Here that generator is roster history, and
the free hook already exists in D8: seeds are shareable, so a player can hand
over their catastrophe — same roster, same seed, different leadership — and dare
someone to save it.

**New degeneracy detector — roster laundering.** A leader policy that burns and
replaces pieces achieves a mean credence comparable to one that maintains a
roster. If it does, reputation transfer is too weak and the bench is an escape
hatch.

**New degeneracy detector — act one is the whole game.** Acts two and three do
not measurably differ in starting credence or difficulty, meaning the reputation
carried between kings is decorative.

**Persistence.** The career is the top-level save entity; roster identities
persist across acts within a career and, as legacy history, across careers.

**Content validation.** Pack coverage becomes a CI check: every situation key
reachable by the simulation must have at least one line in every shipped pack,
or the fallback must be explicit.

## Alternatives considered
- **One king, one campaign.** Rejected as the *frame*, accepted as the shipping
  scope (§5). It cannot express the roster outliving commanders.
- **Unlimited appointments.** Rejected: with no career-terminal state, dismissal
  costs nothing and ADR 0021's ladder collapses.
- **Deep bench without reputation transfer.** Rejected: it is a trust-laundering
  machine and would quietly delete the subject of the game.
- **Separate exec-lab build.** Rejected: two codebases, and the leadership
  content would drift from the simulation that generates it.
