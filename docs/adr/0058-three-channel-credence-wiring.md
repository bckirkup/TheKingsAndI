# ADR 0058 — Wiring the three channels: disposition, relationship accounts, and the check-out boundary

- **Status:** Accepted for the wiring slice; the disposition distribution is
  **open** and owner-owned
- **Date:** 2026-08-20
- **Scope:** Piece identity, credence carriage across commanders, persistence,
  passports
- **Implements:** ADR 0035 (three-channel keyed credence, D49), which has stood
  recorded as **not wired**
- **Prerequisite for:** ADR 0054 slice 4 (the shared cohort market)
- **Related:** ADR 0016 (rumor carries appraisals only), ADR 0019 (two-channel
  trust), ADR 0026 (a community of pieces), ADR 0057 (the private squad)

## Context

Slice 4 makes pieces circulate between commanders. A market of that shape needs
a piece to be able to distinguish an **injury** from a **grudge**: distrustful
of everyone because she has been used up, versus distrustful of *this*
commander and ready to serve someone else. ADR 0035 decided that distinction
and nothing implements it. Today a piece carries a single
`{tauBenev, tauAbil}` pair about "the leader", so:

- a piece leaving a tyrant arrives at a decent commander already mistrustful of
  a man she has never met;
- recruitment averages her opinion of one commander with her opinion of
  another (`src/orchestration/campaignPolicy.ts:99-114`), which is not a
  meaningful quantity;
- a decline would express her mood rather than a judgement about *whom* she is
  declining, so "nobody will take your calls" becomes indistinguishable from
  "she is used up" — and the ADR 0026 *captive labour* detector would be
  measuring the wrong thing.

## Decision

### 1. The three channels take their shipped homes

- **Disposition** — how trusting this individual is by nature. Derived from the
  identity's creation seed, stored on `PieceIdentityRecord`, never a live PRNG
  draw at first encounter, and never surfaced as a number (ADR 0035 §2/§3).
- **Relationship** — a per-commander account, `Record<LeaderId, account>`, held
  on the identity record beside the disposition. Initialized from the
  disposition prior the first time the piece serves that commander.
- **Damage** — `B_i` remains global to the piece and unchanged.

The accounts live on the identity rather than in a new table because the
passport already carries the identity, so all three channels travel with a
piece without new plumbing (ADR 0035 "passports carry all three channels").

### 2. `PieceState.credence` becomes the active account, not the whole history

Per-ply psychology continues to read one `credence` pair, unchanged. That pair
is redefined as the **account for the commander she is currently serving**,
checked out at the start of service and checked back in at the end:

```ts
// orchestration, at career/season start and at match end
const serving = checkOutCredence(identity, leaderId, piece); // account or disposition prior
const updated = checkInCredence(identity, leaderId, servedPiece); // identity gains the account
```

This is deliberate scope control: no equation in `psychology/` changes, the
deterministic core is untouched, and a single-commander career or harness season
produces byte-identical output. The keying earns its keep only when a piece
serves a second commander, which is exactly slice 4.

### 3. Disposition ships as a narrow band with a probe

ADR 0035 left the distribution family, mean, variance, and any floor to the
owner, and this ADR does not choose them. The wiring ships with a
`DISPOSITION_SPREAD` of **zero** — every disposition equals today's neutral
prior, so behaviour is unchanged and measurable — plus a sensitivity probe
proving the knob moves roster composition. Widening it is a calibration
decision with measured numbers, not a default chosen here.

The open question stands as ADR 0035 recorded it: a wide draw can hand a
commander a roster of natural sceptics, which is a day-2.5 frustration risk and
may need a floor on the draw or a constraint on roster mean.

### 4. Migration decides the two things ADR 0035 left to a migration

Schema v3, forward-only:

- an existing scalar pair becomes the account for the **career's player
  commander**, because that is the only commander the piece has served;
- pieces created before dispositions existed receive the neutral prior, not a
  retroactive draw, so no existing career changes behaviour on upgrade.

## Consequences

Reputation transfer stops averaging unrelated relationships and instead reads
the account for the commander in question, falling back to the disposition
prior with rumor as the only other input for a commander never served — rumor
carrying appraisals and never board facts (ADR 0016).

A `LeaderId` convention becomes load-bearing. The codebase already mints
`opponent:<archetype>`, `king:field-command`, and pool commander ids; slice 4's
market needs those to be stable identities rather than incidental strings.

**Degeneracy risk this introduces.** Accounts keyed per commander mean a piece
can hold a grudge nobody can read. If every account converges to the same value
in measurement, the keying is decoration and the market gains nothing — the
harness must show account divergence across commanders for the same piece
before slice 4's decline mechanism is worth calibrating.

## Alternatives considered

- **Key credence inside `psychology/` and pass the leader id per ply.** The
  faithful reading of ADR 0035, and rejected here: it rewrites every credence
  consumer and re-ranges every calibrated coefficient, for no behavioural gain
  while a piece serves one commander at a time.
- **A separate `pieceRelationships` table.** Cleaner for a registry tier, but
  the passport would then carry a piece whose relationships stayed behind.
- **Carry the scalar pair across commanders as-is.** The status quo, and the
  reason a market cannot be built on it: it makes declining a mood.
