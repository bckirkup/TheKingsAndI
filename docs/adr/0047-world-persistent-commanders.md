# ADR 0047 — The world is the unit of simulation

- **Status:** accepted
- **Date:** 2026-08-10

## Decision

Headless simulation now has a world layer. A world contains commanders with
stable identities, styles, and persistent rosters. A pairing is an encounter
between a white-side commander and a black-side commander; both commanders'
rosters are carried to the next pairing or match.

A commander owns its roster. This slice does not transfer a roster to a
different commander, and it does not model free agency, cross-commander
credence, shared trauma, retirement, or persistence through the Dexie/world
tables. Those remain ADR 0026 and future-world work.

Commander identities are side-fixed: `w:servant` and `b:servant` are distinct
commanders because piece IDs are side-scoped, so changing a roster's colour
would require an identity and dyadic-affinity remap. The consequence is that a
style's career is represented by two commanders, one per side, rather than by
one commander switching colours.

The campaign checkpoint now stores both rosters and an explicit checkpoint
version. Checkpoints from the pre-world format are rejected rather than
silently interpreting a missing enemy roster.

Persistent careers also preserve each carried piece's traits, not only its
memories and credence. Newly restored pieces receive their initial traits;
existing identities do not have their dispositions randomly re-rolled between
matches.

## Symmetric enemy tracking

`ENEMY_TRACKED_IDENTITIES` remains the default engine-cost knob for ordinary
headless matches. The harness can request the full 16-piece enemy roster
through `enemyTrackedIdentities`, which the world and campaign runners do by
default.

The previous default cap selected the top eight pieces by `E_i`. That is not a
neutral sample: it systematically excludes pawns, while the ability-drip
mechanism in ADR 0044 is especially relevant to pawns. Results collected with
the old cap must therefore be labelled as asymmetric tracking measurements.

## Opposing commanders

The opponent is selected by an explicit `OpponentArchetype`. The same
archetype drives both the tactical move policy and the enemy psychology path
within a match. The harness accepts only the explicit opponent-style union;
leader styles without an opponent counterpart fail at the CLI boundary rather
than silently falling back to `random`.

## Determinism

The world seed deterministically creates commanders and shuffles the
style-pairing schedule with the seeded PRNG. Pairing seeds derive from the
world seed and a multiplicative pairing/match sequence. Replaying a world with
the same seed, style set,
and engine determinism ID produces the same schedule and event stream.

## Deferred

This ADR does not unify harness checkpoints with application persistence,
implement free agents or commander refusal, create a shared trauma pool,
retire pieces as world events, or add a free-agent market. Cross-commander
credence remains explicitly deferred by ADR 0026 §3.
