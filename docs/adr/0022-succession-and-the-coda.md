# ADR 0022 — After dismissal the game continues without the player, and the successor is worse at chess and better at command

- **Status:** accepted (owner ruling, 2026-07-27)
- **Resolves:** **D55** (what happens after dismissal), **D56** (can the player be
  recalled), and the dismissal branch of **D29** (post-collapse epilogue)
- **Refines:** ADR 0015 (credence), ADR 0019 (two channels), ADR 0021 (mandate)

## Context

> **"So here's the million-dollar question... what happens to the game if the
> player is dismissed? Is the King better than the player? Because... the show
> must go on."**

ADR 0021 made dismissal a terminal state in which the roster survives intact. A
terminal state that cuts to black wastes the only ending where everyone is still
alive — and the roster's survival is precisely what makes a continuation
possible.

## Decision

### 1. The campaign continues under a successor; the player watches
On dismissal the match/campaign does not end. The King takes personal field
command and play continues, rendered and audited exactly as before, with the
player as a spectator holding no order authority. Nothing new is required to
support this: D5 already makes leadership side-agnostic and AI-drivable, and
D49 keys credence by `LeaderId`.

### 2. The successor is a worse tactician who gets better results
This is not authored; it is ADR 0015 with the coefficients swapped.

```
V_perceived = (1 − τ)·V_own + τ·V_leader_implied
```

The player's `V_own` was the strongest on the board and his `τ` had collapsed,
so his judgment could not reach it. The King's breadth-without-depth (ADR 0021
§1) makes him a *mediocre* tactician, but he holds full mandate, so his mediocre
plan is actually executed. **The army plays better under a worse commander.**

That sentence is the thesis of the entire project, and after this ADR it is
demonstrated by the simulation rather than asserted by the narration.

### 3. The successor's honeymoon is a consequence of the ADR 0019 rates
A new leader begins with `τ_benev` high — he has never betrayed anyone — and
`τ_abil` low, because he has no track record. Faith is fast and competence is
slow, so **every** new leader inherits relational credit and evidential doubt.
No special-casing: a successor is simply a `LeaderId` with an empty history.

### 4. The King's weakness in command is specific and legible
A King in personal command is a commander whose own safety *is* the objective
function (ADR 0021 §3), so he plays **cautiously** — grinding draws where the
player would have pressed for a win. His failure mode is therefore neither
stupidity nor malice, and it is visible to a watching player within a few moves.

### 5. The debrief scores two columns, not one
| Column | Measures | Under a dismissed player |
|---|---|---|
| **Board quality** | mean centipawn quality of the *orders issued* | high |
| **Execution fidelity** | share of orders actually carried out, unrefused, unoverridden | low |

The successor inverts both. The gap between the columns *is* the player's
diagnosis, stated in numbers about himself, and it is the single most useful
artifact the exec-lab track can produce.

### 6. The outcome is computed, never guaranteed
Two epilogues, selected by what the roster's state actually supports:

- **You lost the room.** The successor outperforms you. Vindicating for the
  pieces, humiliating and instructive for the player.
- **You broke the roster.** The successor fails too. This is the *worse* ending,
  not the better one: the player did not merely fail, he left ruins that nobody
  could command. The testimony should make that distinction unmistakable.

Both must occur across seeds. A successor who always succeeds is the game
lecturing, and is a bug — see the detector below.

### 7. Recall is computed, not granted (D56)
If the successor stalls — `P(loss)` under his command drifting worse than it was
under the player, with the player's mandate off the floor — the King may recall
the player. The roster then holds something it never had before: a **comparison**.

This is the redemption arc ADR 0007 refused to give away for free. It is earned
rather than forgiven, it requires a changed policy to survive (D24), and it is
the one path on which being dismissed makes the player better.

## Consequences

**New degeneracy detector — scripted humiliation.** Successor performance is
insensitive to roster state, or the successor outperforms the player across
substantially all seeds. Both mean the epilogue is an authored lesson rather
than a simulated consequence, which violates ADR 0001 in spirit: the narration
would be determining the outcome.

**New degeneracy detector — cheap recall.** Recall fires so often that dismissal
carries no weight, or never fires at all, making §7 dead content.

**Determinism.** Successor play is ordinary AI leadership under the seeded PRNG,
so the coda replays byte-identically like any other segment (D48 barrier
applies unchanged).

**Scope.** The coda is bounded: the remainder of the current match plus an
optional fast-forward of remaining campaign matches with the audit shown, not an
unbounded spectator mode.

## Alternatives considered
- **Cut to black on dismissal.** Rejected: wastes the only ending in which the
  roster survives, and the owner's "the show must go on" is the stronger
  instinct.
- **Successor is a scripted foil who always wins.** Rejected: it is the same
  lesson every time, it is unfalsifiable, and it insults a player whose roster
  was genuinely unrecoverable.
- **Player keeps playing as the King's subordinate.** Rejected for MVP: it needs
  a partial-authority order model, and spectating is the sharper experience —
  watching your army obey someone else is the punishment.
