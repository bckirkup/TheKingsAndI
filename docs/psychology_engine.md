# The Psychology Engine — Mathematical Specification

_Planning document. Notation is reconstructed from the source SRS (whose
formulas were embedded as images); every constant below is a **placeholder to
be calibrated** by the headless harness (`docs/testing_strategy.md` §4)._

---

## 1. Piece state

Each piece `P_i` carries persistent state across matches:

| Symbol | Field | Range | Notes |
|---|---|---|---|
| `id` | immutable UUID | — | survives capture, promotion, benching |
| `X_i` | experience | `0..100` | grows with plies played and matches survived |
| `T_i` | trust in leader | `-100..100` | drives the verdict ladder |
| `M_i` | morale | `0..100` | fast-moving; `0` gates mutiny |
| `B_i` | betrayal / grief | `0..100` | slow-decaying trauma accumulator |
| `A_{i,j}` | dyadic affinity | `-100..100` | sparse map, per peer piece |
| `C_{r,r'}` | class bias | `-100..100` | per-roster matrix over roles |
| `Θ_i` | trait vector | see §2 | immutable per piece (rolled at creation) |
| `η_i` | engagement factor | `0.2..1.0` | derived, not stored |

`A_{i,j}` is **not** assumed symmetric: a Rook may hold a Pawn in contempt
while the Pawn idolizes the Rook. Storage is a sparse adjacency list keyed by
peer id; absent entries fall back to `C_{role(i),role(j)}`.

## 2. Trait vector `Θ_i`

Five scalars in `[0,1]`, rolled at piece creation and immutable thereafter
(personality is stable; *state* changes, not character):

| Trait | Meaning | Primary effect |
|---|---|---|
| `θ_courage` | resistance to fear of capture | discounts own capture risk |
| `θ_ambition` | desire to capture high-value enemies | rewards material gain |
| `θ_loyalty` | trust weight vs. self-preservation | scales `T_i` term |
| `θ_empathy` | distress at peers being lost/fired | scales peer terms and firing decay |
| `θ_prestige` | class-rank sensitivity | amplifies `C_{r,r'}` effects |

## 3. Insight allocation

```
η_i = clamp(0.2, 1.0, f_engagement(T_i, M_i, B_i))
d_i = round( d_min + (d_max - d_min) · (X_i / 100) · η_i )
d_min = 2, d_max = 16
```

Quiet quitting is implemented purely as `η_i → 0.2`: the piece still obeys, but
its advice degrades to shallow search plus bias noise.

## 4. Move utility

For a proposed move `m` of piece `P_i`:

```
U(P_i, m) =  w_board · ΔEval(m)                     // shared strategic value
           + w_ambition · θ_ambition · ΔMaterial(m)
           - w_risk · (1 - θ_courage) · ΔP_capture(i, m)
           + w_loyalty · θ_loyalty · (T_i / 100)
           - w_grief  · (B_i / 100)
           + Φ(P_i, m)                              // inter-piece protection
```

with the **inter-piece protection term**

```
Φ(P_i, m) = -w_peer · θ_empathy · Σ_{j ≠ i}  Â_{i,j} · ΔP_capture(j, m)

Â_{i,j} = normalized affinity in [-1,1], = A_{i,j}/100 if present
          else C_{role(i),role(j)}/100
```

Sign semantics: exposing a *loved* peer (`Â > 0`) subtracts utility →
protective refusal. Exposing a *despised* peer (`Â < 0`) adds utility →
indifference or satisfaction. This is the mechanic that makes class contempt
legible at the board level, so it must be surfaced in the UI, not just the math.

`ΔEval(m)` is the piece's *own* evaluation at depth `d_i` — a low-experience
piece computes a different, worse `ΔEval` than a veteran looking at the same
board. This is where variable insight enters the utility function rather than
being a cosmetic advice-quality knob.

## 5. Verdict ladder

Verdict is a function of `(T_i, M_i, U)`, evaluated top-down:

| Condition | Verdict | Mechanical effect |
|---|---|---|
| `T_i > 50` and `U ≥ 0` | `ENTHUSIASTIC` | move executes; full insight shared; proactive advice |
| `0 < T_i ≤ 50` | `COMPLIANT` | move executes; standard dialogue |
| `-50 < T_i ≤ 0`, or `U` marginally `< 0` | `QUIET_QUIT` | move executes; `η_i → 0.2`; cynical line; advice degraded |
| `-80 < T_i ≤ -50` and `U < τ_refuse` | `REFUSE` | move rejected; piece proposes an alternative |
| `T_i ≤ -80` and `M_i = 0` | `MUTINY` | piece deserts (see §7) |

`τ_refuse` is a calibrated threshold, not a hard `0`, so that a
moderately-distrustful piece still executes a *slightly* bad move.

**Open decision:** whether `REFUSE` costs the player the turn.
See `docs/adr/0002-refusal-turn-cost.md`.

## 6. Witnessed events

Emitted by the orchestrator after each ply and folded into psychology state:

| Event | Dyadic | Class | Self |
|---|---|---|---|
| Peer `j` sacrificed itself protecting `i` | `A_{i,j} += 50` | `C_{role(i),role(j)} += 15` | `B_i += 10` |
| Peer `j` captured while `i` was safe nearby | `A_{i,j} += 5` | `C += 2` | `B_i += 5·θ_empathy` |
| Player protected `i` from a threat | — | — | `T_i += 15`, `M_i += 10` |
| Player exposed `i` for no material gain | — | — | `T_i -= 20`, `B_i += 15` |
| Player traded `i`'s safety for a winning line | — | — | `T_i ± f(θ_loyalty, outcome)` |
| Match won | — | class solidarity `+5` | `T_i += 10`, `M_i += 20` |

All updates clamp to range and pass through a **per-ply budget** so a single
chaotic ply cannot swing a piece from loyal to mutinous; large narrative swings
should require repeated behavior. (Calibration target: no more than ~25 trust
points of movement per ply from all sources combined.)

## 7. Firing / benching penalty

Firing piece `P_k` from the persistent roster:

```
T_k  := -100                            // the fired piece, if ever re-recruited
∀ j ≠ k:  T_j -= (κ_fire · θ_empathy_j · (1 + Â_{j,k}))
```

with `κ_fire` calibrated so that a single firing is survivable but a purge is
culturally catastrophic. This is the "commodity paradox" mechanic and is the
central lesson of the exec-lab track; it must be *visible* in the debrief.

## 8. Desertion mechanics (chess-legality problem)

A piece leaving the board is not expressible in standard chess. Three
candidate implementations, decision pending in
`docs/adr/0003-mutiny-board-representation.md`:

| Option | Board effect | Legality risk |
|---|---|---|
| A. **Removal** | piece disappears from FEN | safe (unless king); pure material loss |
| B. **Frozen obstacle** | piece stays, permanently immovable, still blocks and still defends nothing | needs custom rules layer over chess.js; no FEN violation |
| C. **Defection** | piece changes color | can create illegal positions (instant self-check, two-check states); highest engineering + balance risk |

The King must be exempt from mutiny in all options, or the game ends by
psychology rather than by chess. Recommendation: ship **B** (most dramatic,
FEN-safe, reversible via re-recruitment), keep **C** as a post-MVP variant.

## 9. Invariants (assert in tests)

1. All psychological fields remain in range after every event fold.
2. Psychology never mutates chess state directly; it only produces verdicts.
3. Verdict is a pure function of `(T, M, U, thresholds)` — no RNG, no clock.
4. Same `(roster, seed, intents)` → identical event log, byte for byte.
5. No LLM output is ever read back into psychology state.
6. Class bias `C` is per-roster (leadership culture), not global to the player.
