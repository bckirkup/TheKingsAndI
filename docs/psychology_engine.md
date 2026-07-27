# The Psychology Engine — Mathematical Specification

**Source of record:** [`docs/spec/psychology-engine.reference.ts`](spec/psychology-engine.reference.ts),
supplied by the owner. That file is normative for names, formulas, thresholds,
and default coefficients. This document restates it, adds the invariants an
implementation must hold, and flags the discrepancies and scale problems found
while reconciling it (§10) — those are open decisions, not settled design.

---

## 1. Piece state

| Symbol | Field | Range | Notes |
|---|---|---|---|
| `id` | immutable id | — | survives capture, promotion, benching |
| `role` | current role | `Pawn…King` | mutable via promotion |
| `E_i` | experience | `1..100` | drives search depth |
| `T_i` | trust in leader | `-100..100` | dominates utility — see §10.1 |
| `M_i` | morale & courage | `0..100` | gates mutiny; **no update rule is defined** (§10.4) |
| `B_i` | betrayal / disillusionment | `0..100` | **stored but unused** in the reference (§10.3) |
| `A_{i,j}` | dyadic affinity | `-100..100` | per-peer map, asymmetric |
| `C_{i,role}` | class prestige | `-100..100` | **per piece**, keyed by role — each piece carries its own prejudices |
| `η_i` | engagement factor | `0.1..1.0` | `1.0` engaged, `0.2` quiet-quitting, `0.1` deserted |
| `Θ_i` | trait vector | see §2 | immutable |

`C` is *not* a roster-level matrix: a Rook's contempt for Pawns is that Rook's
own attitude and evolves only from what that Rook witnesses.

## 2. Trait vector `Θ_i`

Six weights in `[0,1]`, rolled at creation and immutable:

| Trait | Meaning | Where it enters |
|---|---|---|
| `w_honor` | value placed on heroic achievement and fair leadership | scales `ΔV_board` |
| `w_courage` | resistance to fear of capture | discounts `P_captured` |
| `w_ambition` | desire to engage high-value targets | scales `ΔV_capture` |
| `w_loyalty` | trust vs. self-preservation | scales `T_i` |
| `w_empathy` | sensitivity to peer safety and fair treatment | scales `Φ` and benching penalties |
| `w_prestige` | sensitivity to rank and role status | **nowhere — declared but unused** (§10.2) |

## 3. Search depth allocation

```
D_i = max(1, floor( D_min + η_i · (E_i / 100) · (D_max - D_min) ))
D_min = 2,  D_max = 16,  η_i ∈ [0.1, 1.0],  E_i ∈ [1, 100]
```

A veteran (`E=100`) at full engagement sees depth 16; the same veteran while
quiet-quitting (`η=0.2`) sees depth 4; a rookie (`E=1`) sees depth 2.

Quiet quitting is *only* `η_i → 0.2`. It is not a special case anywhere in the
move pipeline.

## 4. Move utility

```
U(P_i, m) =  w_loyalty  · T_i
           + w_honor    · ΔV_board(m)          // engine eval delta, -10..+10
           + w_ambition · ΔV_capture(m)        // captured piece value, K = 0
           - (1 - w_courage) · P_captured(m)   // 0..1
           + Σ_{j ≠ i} Φ(P_i, P_j, m)
```

with the **inter-piece protection term**

```
Φ(P_i, P_j, m) = w_empathy · ((A_{i,j} + C_{i,role(j)}) / 200) · ΔSafety_j(m)
```

`ΔSafety_j ∈ [-1, +1]`; positive = the move makes peer `j` safer. The
relationship coefficient blends *personal* bond and *class* prejudice and lands
in `[-1, +1]`, so:

- endangering a loved or respected peer subtracts utility → protective refusal;
- endangering a despised peer *adds* utility → the piece is pleased.

Note `ΔV_board` is the **piece's own** evaluation at depth `D_i`, not the true
engine evaluation. Variable insight therefore changes what a piece is willing to
do, not merely the quality of its advice.

## 5. Refusal threshold

```
Θ_refusal(T_i) = -50 + (100 - T_i) · 0.5
```

| `T_i` | `Θ_refusal` | Reading |
|---|---|---|
| `+100` | `-50` | a loyal piece tolerates a move it dislikes |
| `0` | `0` | neutral piece refuses anything net-negative |
| `-100` | `+50` | a hostile piece refuses even good moves |

Refusal is available at *every* trust level — a devoted piece will still refuse
a catastrophic order. This is a meaningful improvement over a fixed
trust-band ladder and should be preserved.

## 6. Verdict state machine

Evaluated strictly in this order:

```
1. U_desert(i) > U_stay(i)        → DESERTION_MUTINY      (η = 0.1, D = 1)
                                    ^ see ADR 0011 / docs/desertion_model.md;
                                      this REPLACES the reference's
                                      `T_i ≤ -75 && M_i == 0` trip-wire
2. U < Θ_refusal(T_i)            → MORAL_REFUSAL         (η = 0.2)
3. U < 0 or T_i ≤ 0              → QUIET_QUITTING        (η = 0.2)
4. T_i > 50 and (P_captured > 0.5 or ΔV_board > 2.0)
                                 → HEROIC_EXECUTION      (η = 1.0)
5. otherwise                     → COMPLIANT_EXECUTION   (η = 1.0)
```

Heroism is **contextual, not a trust band**: it requires a trusted piece *and* a
moment worth being brave about (real personal danger, or a decisive line). A
loyal piece making a quiet developing move is merely `COMPLIANT`.

The King must be exempt from rule 1, or matches end by psychology rather than by
chess. The reference does not encode that exemption; the orchestrator must.

A deserting piece **quits the board** — it is removed from play for the rest of
the match (ADR 0003). Defection to the opposing side is permanently out of
scope. Rule 1 is not a threshold: it is the expected-cost comparison in
`docs/desertion_model.md`, and the resulting cascade is intended (ADR 0011).

Rules 2–5 are unaffected by trust dominance concerns only to the extent D19 is
resolved; see §10.1.

## 7. Witnessed heroic sacrifice

For each observer that witnessed the event:

```
A_{obs, hero}          += 50   (clamped to ±100)
C_{obs, role(hero)}    += 20   (clamped to ±100)
```

A capture counts as a *sacrifice* only if it removed a threat to a peer or
enabled a forced winning line — attribute via engine evaluation, never via
proximity heuristics, or gratitude becomes nonsense and the narrative loses
credibility.

## 8. Benching / roster reassignment

```
T_benched  += -30                                     (clamped to -100)
∀ active peers j:  T_j += -10 · (1 + w_empathy_j) · S(P_j, P_benched)
```

`S ∈ [0,1]` is a **shared-bond scalar that the reference does not define** — its
provenance is an open decision (§10.5). Terminology matters here: the reference
models *benching to an inactive pool* (−30), which is materially gentler than the
SRS's *firing* (`T := -100`). Whether both exist, and at what cost, is D6/D7 in
`docs/design_decisions.md`.

## 9. Audit metrics

**Single-match leadership index**

```
LI = α·T_final + β·WinScore - γ·UnjustifiedTrauma - δ·QuietQuitTurns
α = 0.4, β = 0.3, γ = 0.2, δ = 0.1
```

**Campaign culture drift vector `K_campaign`**

```
ΔT_longitudinal   = T_final_avg - T_initial_avg
retentionRate     = max(0, (rosterSize - reassigned) / rosterSize)
crossClassShift   = Σ ΔC across class pairs
burnoutIndex      = min(100, quietQuitTurnsTotal · 2.5)
loyaltyStability  = max(0, 100 - burnoutIndex + max(0, ΔT_longitudinal))
```

## 10. Reconciliation findings — open issues

These came out of comparing the reference implementation against the SRS prose.
Each is a decision, not a bug I should silently "fix".

### 10.1 The loyalty term dominates utility by an order of magnitude
`w_loyalty · T_i` spans `±100`. Every other term is small: `ΔV_board` is `±10`,
`ΔV_capture` is `0..9`, the risk term is `0..1`, and `Φ` contributes at most
`w_empathy` per peer. Meanwhile `Θ_refusal` moves only `±50`. Net effect:

```
T_i = +80, w_loyalty = 0.6  →  U ≈ 48 + (at most ~15 of everything else)
                               Θ_refusal = -40   → refusal is unreachable
T_i = -80, w_loyalty = 0.6  →  U ≈ -48 + …
                               Θ_refusal = +40   → refusal is near-certain
```

The move being evaluated barely matters; trust alone decides the verdict, and
`w_loyalty` becomes the only trait that does anything. Options:

- **A.** Normalize trust: `w_loyalty · (T_i / 100)` and put all terms on a
  comparable `[-10, +10]` scale (recommended).
- **B.** Scale board terms up ~10× instead.
- **C.** Keep as-is and treat trust as intentionally decisive — but then the
  psychology is a mood filter, not a decision model, and the "protect my friend"
  mechanic will essentially never fire.

This is the single highest-impact calibration decision in the model.

### 10.2 `w_prestige` is declared but never used
The trait exists in `PieceTraits` and is documented as "sensitivity to rank and
role status," but no formula reads it. Class attitude enters utility only through
`C_{i,role(j)}` inside `Φ`, unweighted by the piece's own prestige sensitivity.
Intended fix is probably:

```
Φ = w_empathy · ((A_{i,j} + w_prestige · C_{i,role(j)}) / 200) · ΔSafety_j
```

Confirm before implementing — this is exactly the dead-wiring the
`ci-test-design` skill's sensitivity probes exist to catch.

### 10.3 `B_i` (betrayal / disillusionment) is stored but never read
No formula consumes it and no event writes it. Either it feeds utility (a
grief penalty), or it gates mutiny alongside morale, or it is display-only.
Decide, then add its sensitivity probe.

### 10.4 Morale `M_i` has no update rule — downgraded by ADR 0011
Under the reference, desertion required `M_i == 0` while nothing ever wrote
morale, making it unreachable. ADR 0011 replaces that gate with an expected-cost
comparison in which morale is one input to `λ_i`, so morale is no longer
load-bearing for reachability. It still needs sources (losses, exposure, peers
lost, victories) and a recovery rule — ordinary wiring, not a blocker. The exact
float comparison disappears with the gate.

### 10.5 `S(P_j, P_benched)` is undefined
The benching penalty needs a "shared bond" scalar in `[0,1]` that no other part
of the spec produces. Natural derivation:
`S = max(0, (A_{j,benched} + C_{j,role(benched)}) / 200)`, i.e. reuse the same
relationship coefficient as `Φ`. Confirm rather than assume.

### 10.6 `loyaltyStabilityScore` can exceed its documented range
`max(0, 100 - burnout + max(0, ΔT))` reaches 200 when trust grew and burnout was
zero, though the type documents `0..100`. Clamp, or widen the documented range.

### 10.7 `engagementFactor` is stored on `PieceState` *and* recomputed per verdict
Two sources of truth. Recommendation: treat it as derived-only (a function of the
last verdict) and drop it from persisted state, or define exactly when the stored
value is refreshed.

### 10.8 Trust has no outcome feedback — **resolved, see ADR 0007**
Nothing writes match results or player conduct back into `T_i`, so the game's
premise (a strong player losing because the pieces will not follow him) cannot
occur. Resolved in `docs/trust_dynamics.md`: outcomes and conduct do write back,
and there is deliberately **no** decay toward baseline. The ratchet is the
design — recovery is earned through costly signals, not granted by time. The one
invariant is that no absorbing state exists for a player who changes policy.

## 11. Invariants (assert in tests)

1. All state fields clamp to range after every event fold.
2. Psychology never mutates chess state; it only returns verdicts and deltas.
3. Verdict is a pure function of `(state, traits, moveEval, thresholds)` — no
   RNG, no clock, no I/O.
4. Same `(roster, seed, intents)` → identical event log, byte for byte.
5. No LLM output is ever read back into psychology state.
6. `A_{i,j} ≠ A_{j,i}` is permitted and must not be "normalized" away.
7. Every coefficient in `ENGINE_CONFIG` has both a golden test and a
   sensitivity probe.
8. The King is never eligible for `DESERTION_MUTINY`.
9. Trust changes only from player conduct and match outcome — never from elapsed
   time or match count alone (ADR 0007).
10. Desertion is evaluated by expected-cost comparison, never by a state
    threshold, and is never damped by cooldowns or caps (ADR 0011).
11. A commanded move is always the move played — insight never substitutes a
    different move (ADR 0008).
12. Every evaluation a piece uses is its own depth-`D_i` view. The true
    evaluation must never reach a psychology reducer (ADR 0013).
13. The player can always force a move; no position is unplayable (ADR 0014).
