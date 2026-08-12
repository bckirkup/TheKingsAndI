# ADR 0048: Season careers use scarce commander-owned pools

Date: 2026-08-12

## Status

Accepted for the season simulation slice. Calibration values remain open.

## Context

The campaign and world layers previously restored a full sixteen-piece lineup
from the starting squares for every match. Attrition therefore ended at the
match boundary: a deserter could return in the next match with the same
identity and grudge. Published attrition numbers were consequently
cross-match-free measurements of leaders who burned a lineup and received the
same sixteen identities back. This is the infinite-pool degeneracy named in
ADR 0029.

## Decision

A season commander owns a persistent pool of square-independent identities.
Pool members have a fixed role, persistent psychological state, provenance,
and service history. Each match fields sixteen members from that pool. Pool
depth is a season configuration knob based on the starting lineup's role
counts; the King is exactly one, always fields, and is never retired or
replaced.

Fielding is an explicit leadership act separate from move selection. Named
deterministic policies select available members by role with stable identity
tiebreaks. Shortfalls are filled by conscripts. Conscripts receive ability
credence from the commander's record and benevolence credence from the current
appraisal of the existing pool; recruitment is therefore not a
trust-laundering reset. In this slice, both quantities are deterministic means
over the non-retired pool record; this is an explicit implementation
interpretation pending calibration.

Desertion creates a term-based absence. Captures return on the next match.
Trauma at the retirement threshold retires a non-King permanently within the
season. No trust, trauma, credence, morale, or other state decays during
absence or rest. Recovery consists only of re-availability and conscription.

The season emits raw per-match metrics, horizon series, and pool snapshots.
It does not emit an aggregate season score, weighted scorecard, or
Pareto-frontier result.

## Consequences

Scarcity can make preservation rational: burning identities reduces future
availability and can force reputation-bearing conscription. The pool is the
career source of truth rather than lineup restoration.

Commander identities remain side-fixed. `w:servant` and `b:servant` are
distinct identities because piece IDs are side-scoped; changing a roster's
colour would require an identity remap. A style's career is therefore split
across its white and black commanders.

This layer also settles that identity traits persist with the identity rather
than being regenerated when a career continues. The default campaign/world
paths retain their historical behavior unless they explicitly opt into season
lineups.

## Deferred work

- season scorecard and Pareto-frontier detector;
- migrating `runWorldRoundRobin` onto pools;
- human cohorts and facilitator workflows;
- unifying Dexie persistence and `worldTypes` with season records.

The fielding-policy mapping, scarcity ratio, desertion absence term, and
retirement threshold remain open calibration decisions in the register.
