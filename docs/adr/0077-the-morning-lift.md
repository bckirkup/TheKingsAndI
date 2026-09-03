# ADR 0077: The Morning Lift

Date: 2026-08-30
Status: Accepted (D207 ruled at permille 400, baseline 0 — 2026-09-02 addendum)

## Context

The D205 dismissal terminal can make a cruel campaign a ply-one dismissal
conveyor: once a commander has broken the room, trust carries into the next
match and the next commander is fired before there is a meaningful chance to
play. The owner ruled that a new match must begin with some hope.

> “There has to be some hope that infuses the room at the beginning of a new
> game, newness and spring, and the start of things always brings something”
>
> — owner, 2026-08-30

## Decision

At every match boundary, each fielded piece moves a fraction of the gap between
its trust and a modest dawn baseline:

```text
T_i' = clamp(T_i + trunc((baseline - T_i) * permille / 1000))
```

The lift applies only when `T_i < baseline`; trust at or above the baseline is
unchanged. It applies uniformly to both armies, including each King. It is
deterministic and certain, consumes no PRNG draw, and has no leader-controlled
input or credit to the leader.

The mechanism is parallel to grace in being unearned and unpurchasable, but it
is not stochastic. Only `T_i` moves. `tauBenev`, rupture debt, `B_i`, and
memory remain untouched: the room remembers, but wakes hopeful. The Judgement
Seat mechanism is unchanged and reads whatever the room becomes.

In particular, the lift gives a fallen commander a short real chance after the
previous match's firing: re-firing in a few plies is the drama working, rather
than a match that is over before it starts.

## Status

The wiring is shipped at `MORNING_LIFT_PERMILLE = 400` and
`MORNING_LIFT_TRUST_BASELINE = 0`; the magnitude is ruled by the dated
fine-grid evidence addendum below.

## Addendum (2026-09-02): the magnitude is ruled

The owner ruled `MORNING_LIFT_PERMILLE = 400` and
`MORNING_LIFT_TRUST_BASELINE = 0` on the fine-grid evidence in
`docs/calibration/2026-08-31-the-morning-lift-measured.md` (2026-09-02
addendum). At 400, the ply-≤2 repeat-dismissal conveyor is reduced to
11–25/190, from 150–181/190 at zero, and the median re-dismissal ply is 3–7.
Ply-1 dismissal remains possible for every cruel style, every cruel match
still ends dismissed, supportive is invariant, and the fisher gains nothing.
The owner chose 400 over the recommended 500 to keep a touch more of the
conveyor.

## Consequences

- Campaign boundaries apply the lift before grace and retirement.
- Production fielding applies the lift to the lineup only; bench and pool
  members are untouched.
- Both armies receive the same deterministic treatment.
- The lift changes no psychology channel other than `T_i` and consumes no
  randomness.
