# ADR 0035 — Three-channel credence: disposition, relationship, and damage

- **Status:** accepted
- **Resolves:** **D49** (credence indexed by leader identity)
- **Refines:** ADR 0009 (capture is trauma, not death), ADR 0015 (trust as
  credence), ADR 0019 (two-channel trust), ADR 0026 (a community of pieces)
- **Related:** ADR 0029 (the world ends with the curriculum), ADR 0030 (the
  transcript), ADR 0034 (the deterministic query barrier)

## Context

The current piece model stores one scalar pair, `τ_benev` and `τ_abil`, on each
piece. That pair cannot distinguish a piece that is **damaged** — distrustful
of everyone because it has been used up — from one that holds a **grudge** —
distrustful of this commander specifically, but ready to serve someone else.
That distinction matters most when pieces circulate between participants:
someone else may inherit a wreck, or be remembered by a piece that simply does
not like him.

D49 asked whether credence is indexed by leader identity. The answer is yes,
but the relationship account is not the whole state. The model needs a stable
individual prior and a global record of damage as well as the per-commander
relationship.

## Decision

### 1. Credence has three channels

Every piece has three conceptually separate channels:

1. **Disposition** — a stable trait describing how trusting this individual is
   by nature. It is set once when the identity is created, and is drawn
   pseudorandomly rather than authored per piece. It supplies the prior for a
   commander the piece has never served.
2. **Relationship** — a per-commander account. The existing
   `{tauBenev, tauAbil}` pair becomes keyed by leader identity:
   `Record<LeaderId, { benev, abil }>`. A relationship is initialized from
   the disposition prior when the piece first serves that commander, then
   changes according to that commander's conduct.
3. **Damage** — `B_i`, the piece's trauma. It is already global to the piece
   and remains global. This ADR does not change its update rules or scope.

The useful distinction is therefore:

- high `B_i` with an intact account for the current commander means someone
  else broke the piece;
- a low account with low `B_i` means the piece simply does not like this
  commander.

### 2. Disposition is identity-seeded

The disposition draw **must derive from the piece's identity-creation seed**.
It must not be a live PRNG call when the piece first encounters a commander.
Exporting and reimporting a piece through a passport, or replaying its history,
must therefore reproduce the same disposition without depending on encounter
order or the current process's random stream.

The identity seed and the resulting disposition are part of the deterministic
identity record. Passport serialization and replay verification must preserve
that identity-seeded result.

### 3. Disposition is not a player-facing number

Disposition must never be surfaced to the player as a number, either in the UI
or in a player-facing export. It is something a leader learns by leading;
exposing it would turn the game into a spreadsheet. Whether a facilitator or
audit surface may expose disposition is a separate facilitator-work question
and is not decided by this ADR.

### 4. Existing trauma remains global

`B_i` is not copied into a commander relationship account. Capture, override,
and other damage remain part of the piece's global history, so a piece can
carry damage into a new command even when its relationship account for that
commander begins from disposition.

## Consequences

**`PieceIdentityRecord` needs commander history.** The current identity record
has no history of which commanders a piece has served
(`src/persistence/types.ts`). It must acquire the information needed to
serialize the identity's disposition and relationship accounts across worlds.

**Reputation transfer is now unblocked.** The recruitment helper currently
averages scalar credence values because it has nowhere to record what a piece
thinks of a specific commander (`src/orchestration/campaignPolicy.ts`). It
must later transfer and initialize the appropriate leader-keyed account rather
than averaging unrelated relationships. This ADR does not implement that
change.

**Existing saves require migration.** A migration must decide which commander
today's scalar pair becomes an account for, and what disposition to assign to
a piece created before dispositions existed. This ADR does not choose either
policy or write the migration.

**Passports carry all three channels.** A passport must carry the disposition,
the leader-keyed relationship accounts, and global damage. This interacts with
the existing unsigned-passport gap: the current content digest is not a
signature or an authority model.

**Calibration gains a new seed-dependent axis.** Roster composition now varies
by disposition draw, so calibration must distinguish commander effects from
identity composition.

## Open question

A distribution of dispositions means some seeds may give a player a roster of
natural sceptics. That is a new calibration axis for the criterion that
students are not frustrated by day 2.5, and it may require a floor: bounds on
the draw or a constraint on roster-level mean disposition. The distribution
family, parameters, mean, variance, and any floor are deliberately **not**
chosen here. **Owner: user.**

## Alternatives considered

- **Keep one scalar pair per piece.** Rejected: it cannot distinguish global
  damage from a commander-specific grudge and forecloses meaningful piece
  circulation.
- **Make trauma commander-specific.** Rejected: `B_i` is already the global
  damage history and must follow the piece between commanders.
- **Draw disposition at first contact.** Rejected: encounter order would affect
  identity and break passport portability and replay determinism.
- **Show disposition to the player.** Rejected: it exposes the hidden trait
  instead of making it something learned through conduct.
