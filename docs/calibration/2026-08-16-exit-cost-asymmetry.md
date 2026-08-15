# Why pieces still walk after D145: the exit is free and the fear is fake

Revision: `d362408` (main, D145 default `DESERTION_STAY_ATTACHMENT_PERMILLE = 1000`).
Measurement: one deterministic match per style, `seed=7`, `engine=fake`,
`matchIndex=0`, every `DESERTION` event's recorded `terms` dumped.

D145 fixed the λ-cancellation defect, but `random`, `pure_tactician` and
`redeemer` still end at `desertion_attrition ≈ 0.938`. This report identifies
what carries those remaining departures. It changes no behaviour; it corrects
two of the three suspects listed in D145 and names the decision that has to be
made before any coefficient is touched.

## 1. What the departures actually look like

`random`, 14 departures; `pure_tactician` and `redeemer`, 14 each (identical
term-for-term to each other, as expected from the shared search):

```
style           total  withCaptureRisk  zeroStanding  noPersonalStake
random             14               14             6                0
pure_tactician     14               14             7                0
redeemer           14               14             7                0
```

Representative rows (`margin = U_desert − U_stay`):

```
random  ply=9  w:P:f2 first   margin=1.276 Pcap=0.250 pain=10.0 standing=0.000 piv=0.013 attach=0.913 lambda=0.518
random  ply=17 w:P:g2 first   margin=1.240 Pcap=0.800 pain=10.0 standing=0.000 piv=0.013 attach=0.865 lambda=0.355
random  ply=20 w:B:c1 first   margin=0.173 Pcap=0.800 pain=10.0 standing=2.338 piv=0.043 attach=0.846 lambda=0.298
tact    ply=30 w:N:b1 first   margin=2.091 Pcap=0.800 pain=10.0 standing=2.338 piv=0.038 attach=0.830 lambda=0.290
tact    ply=41 w:Q:d1 first   margin=0.135 Pcap=0.900 pain=12.5 standing=6.704 piv=0.145 attach=0.821 lambda=0.190
```

**Correction to D145 suspect 3.** Every remaining departure has real,
piece-specific capture risk (`withCaptureRisk = 14/14`, values 0.25–0.9), and
`P_captured` is *not* the commanded actor's risk leaking to bystanders: each
piece gets its own post-move threat number from
`features.captureRiskByPiece[piece.id]`
(`src/orchestration/insight.ts:179`, `:385`; `src/chess/features.ts:134`). The
neutral fallback evaluation in `buildDesertionContexts` is not what is firing.

**Correction to D145 suspect 1.** `raiseLossEstimatesAfterDesertion` is not the
amplifier under `k = 1000` either. Raising `pLossTeam` raises `P_lossIfStay`,
and at `k = 1000` the collective term carries the same `λ·attachment` factor on
both branches, so the increase cancels out of the sign; what survives is
`shadowFactor = 1 − P_lossIfStay`, which *shrinks* both capture pain and
standing cost and therefore pushes toward staying. Its residual pro-desertion
effect is indirect and small (it lowers morale and trust, hence λ, hence the
pivotality deterrent).

## 2. The arithmetic that is left

With attachment on both branches, the collective term cancels down to the
pivotality increment, and the decision is:

```
leave  if   P_captured · pain · shadow    >    pivotality · λ · 50 · attachment
                                              + standing · shadow            + 0.05
       ("what staying might cost me")         ("what leaving costs me")
```

Measured magnitudes on the left: `0.25 · 10 · 0.62 ≈ 1.6` for an ordinary
attacked pawn, `0.8 · 10 · 0.45 ≈ 3.6` for an undefended knight.
On the right: pivotality is a piece's *share* of the team's force
(`1/30` for a pawn, `0.145` at scale for the queen), so the collective
deterrent is `0.013 · 0.3 · 50 · 0.85 ≈ 0.2` for a pawn and at most ≈ 1.9 for
the queen; standing is `0.000` for every pawn and `2.3` for a minor piece.
The push term beats the hold term by 5–10× for pawns, which is why the wave
starts on the second rank in every style.

Two structural facts produce that ratio, and neither is a coefficient:

**(a) The exit itself costs the piece nothing.** Desertion removes the piece
from the board exactly as capture does, yet `U_desert` charges no self-cost —
only reputation (`standing`) and a residual share of the team's fate. So
`P_captured · pain` is a cost the piece can *escape* by leaving, when in board
terms leaving is the same outcome it is fleeing. That asymmetry, not λ, is what
makes exit dominant: a piece prices the risk of removal-by-capture at 10+ and
the certainty of removal-by-desertion at 0.

**(b) Class prejudice zeroes the only remaining brake for half the roster.**
`standing` sums `max(0, (affinity + prestige)/200)` over peers
(`src/psychology/desertion.ts:208`), and initial pawn prestige is negative from
every role (`-30` from pawns, `-15` from minors, `-5` from majors,
`src/orchestration/roster.ts:36`). A pawn therefore has, by construction, no
reputation to lose by quitting. This is arguably the model working — prejudice
manufactures deserters — but combined with (a) it means eight of fifteen pieces
have a literally free exit from move one.

**(c) `P_captured` is a threat flag, not a probability.** `captureRiskThousandths`
returns 0.9 / 0.8 / 0.6 / 0.25 for favourable-trade / undefended / outnumbered /
defended, with no notion of whose turn it is, whether the piece can simply step
away, or whether the capture is good for the opponent. Ordinary central tension
prices a defended pawn's life at 25% and a once-attacked knight's at 80% every
ply. Half the roster is told it is probably about to die during normal chess.

## 3. What is not the problem

- Not refusal (measured separately, PR #95).
- Not the leadership channel: λ ranges 0.19–0.59 across these rows and does
  move the margin — it is simply multiplied by a pivotality share of ~1/30.
- Not the per-departure loss bump (§1).
- Not bystander risk leakage (§1).

## 4. Decision required (do not tune first)

Both remaining candidates change the model's shape, so per rule 9 they are
recorded here and not resolved in code:

1. **Charge the exit.** `U_desert` gains an own-future cost — the deserter is
   off the board too, and under ADR 0026 capture is impermanent while
   accumulated trauma and a desertion record are not. This restores the
   dilemma (two removals, priced by dishonour versus trauma) and makes both λ
   and attachment decisive rather than decorative.
2. **Make `P_captured` a probability.** Discount by attacker value versus
   defenders, side to move, and escapability, so "attacked but adequately
   defended by a piece the opponent would not trade into" stops reading as a
   25–80% death sentence.

They are complementary: (1) is structural, (2) is fidelity. Doing (2) alone
lowers the wave's frequency without removing free exit; doing (1) alone leaves
pieces panicking over invented danger.
