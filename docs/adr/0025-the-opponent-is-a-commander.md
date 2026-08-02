# ADR 0025 — The opponent is a commander: morale warfare, rival succession, and difficulty by leadership

- **Status:** accepted (owner ruling, 2026-07-27)
- **Resolves:** **D64** (what the opponent is), **D65** (morale warfare and enemy
  legibility), **D66** (the rival as successor), **D67** (source of difficulty),
  **D68** (deserters in the labour market)
- **Refines:** ADR 0005/0020 (engine), ADR 0011 (desertion), ADR 0017 (topology),
  ADR 0022 (succession), ADR 0023 (career)

## Context

> **"What we are naturally ignoring here is the ... other player."**

Every decision to date concerns the player's own army. The opposing side has been
treated implicitly as an engine producing legal moves. D5 already established
that psychology is symmetric and either army may be human- or AI-led, but nothing
had been decided about what the opponent *is*.

## Decision

### 1. The opponent is a commander with a real roster (D64)
The enemy army has trust, credence, refusals, quiet quitting, desertion, and
routs of its own, driven by an AI leader policy with an archetype (tyrant,
tactician, saint, cold winner — the same oracle policies the harness uses). The
orchestration layer is already side-agnostic, so this is a configuration of
existing machinery rather than a new subsystem.

### 2. Breaking their cohesion is a legitimate way to win (D65)
A player may defeat a stronger tactician by making the enemy army stop believing
in its commander: forcing visible futility, taking the pieces their roster is
watching, making obedience look fatal on their side of the board.

This is the thesis played from the outside, and it is learned far faster as an
attacker than as a victim.

**Enemy state is readable only through behaviour.** No gauges, no numbers, no
enemy audit. But the behaviours are already public: hesitation, wasted tempo, a
piece that stops covering what it was covering — and desertion, which is
literally a piece walking off their board in front of the player. Morale warfare
therefore needs no new UI and no information leak.

### 3. Difficulty comes from opposing leadership, not engine depth (D67)
Raising engine depth makes the game harder in a way that teaches nothing. Facing
a **better leader** — one whose army actually executes his orders — is harder in
the way this game is about.

This permanently retires the "we need a stronger engine" pressure and confirms
ADR 0020's finding from the other direction: the project needs a stable,
depth-addressable engine, never the strongest one.

### 4. The rival replaces you (D66)
ADR 0022 has the King taking personal command after dismissal. The sharper
version, and the one adopted: **the King hands the army to the commander who beat
you**, and the player watches his own roster execute for the rival.

Everything in ADR 0022 survives unchanged — the successor is still an ordinary
`LeaderId` with its own depth and history, still computed rather than scripted.
The King remains the fallback successor when no rival is available. Note the
rival will typically *not* satisfy `D_rival < D_player_effective`, so the
tutorial-coda guard (ADR 0024/0022 §4) applies to the King only; a rival
successor's edge must be shown to come from fidelity in the debrief columns
rather than assumed.

### 5. Your deserters resurface in other rosters (D68)
D3 stands: nobody defects mid-match. But **between careers**, an identity driven
off the board is a free agent, and the labour market may place it with a
commander who kept faith with his people.

Facing a piece you broke, now serving someone else, is the most economical piece
of storytelling available in the design and costs one foreign key. Its credence
in the player is not reset — it remembers.

## Consequences

**Cost.** Full per-piece belief for both armies roughly doubles engine work.
Shared search (ADR 0017) absorbs most of it because the pooled search is
per-position, not per-piece. If the harness shows otherwise, the enemy runs a
reduced set of tracked identities; the observable behaviours are what matter and
they are cheap.

**New degeneracy detector — inert opposition.** Enemy morale never affects the
outcome, or no leader policy can win by cohesion attack alone against a stronger
tactician. Then D65 is decoration.

**New degeneracy detector — telepathy.** Any enemy psychological state reaching
the player except through observable behaviour: no gauges, no audit, no
testimony from the other side.

**New degeneracy detector — difficulty by depth.** Harness difficulty scaling
that works by raising engine depth rather than by improving the opposing leader
policy (D67).

**Symmetry obligation.** Every psychology feature must work when the player is
*not* the leader being modelled. This is a standing test requirement, not a
one-off.

**Multiplayer.** Two human commanders remain out of scope (D13: no backend), but
seed sharing (D8) already permits asynchronous challenge: same roster, same seed,
different leadership.

## Alternatives considered
- **Opponent as a bare engine.** Rejected: it wastes symmetric psychology, makes
  difficulty a depth slider, and denies the player the outside view of the very
  dynamic the game teaches.
- **Enemy morale gauges.** Rejected: an information leak that turns morale
  warfare into a resource meter. Behaviour is legible enough — a piece leaving
  their board is unmissable.
- **Mid-match defection to the enemy.** Rejected: D3, unchanged.
