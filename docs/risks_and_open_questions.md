# Risks & Open Questions

_Ordered by expected damage. "Mitigation" names the milestone that retires it._

---

## R1 — The psychology model is not fun (design risk, highest)
Refusal and desertion may read as *the game cheating* rather than as drama. Every
comparable system (Close Combat's suppression, RimWorld's mental breaks) works
because the player can see the cause coming and had agency to prevent it.

**Mitigation:** M3 calibration + M4 playtest with an explicit "was that fair?"
question; always expose the piece's reasoning and a pre-move risk preview. If a
refusal ever surprises the player, that is a UX bug, not a feature.

ADR 0013 sharpens this: a piece can now refuse a *winning* move in good faith
because it cannot see that far. That is the most fun-critical thing in the
design and the most likely to read as cheating. It only works if the UI shows
the piece's reasoning next to the truth — "Aldric thinks this loses a Rook; he
is wrong" — so the player learns that the failure was communication, not
loyalty. Under ADR
0011 the cascade makes this sharper: a rout is fast and irreversible, so the
player must be able to watch `P_loss` climb and read each departure's grievance
*while it is happening*, not only in the post-match audit.

## R2 — Chess integrity collapses (design + math risk)
Largely retired by ADR 0002 and ADR 0003: refusal costs no turn, and desertion is
a plain piece removal, so the position stays legal at every ply and no frozen
board object exists for chess.js or Stockfish to misread.

The total-refusal case is closed by ADR 0014: the player can always override a
refusal, so the position is always playable and no special stalemate handling is
needed. **This risk is retired.**

What it leaves behind is a *balance* risk, not an integrity one — see D35: an
override priced too low makes the entire psychology skippable with one extra
click. Cover the override path with goldens and track its rate in the harness.

## R3 — Piece identity tracking through chess.js (engineering risk)
chess.js has no notion of piece identity. Castling, promotion, en passant, and
undo all break naive square→id maps, and a corrupted map silently rewrites which
piece "remembers" what — save-file-level damage that is hard to detect late.

**Mitigation:** M1.4 fuzz test over 1,000 random legal games asserting the map's
consistency invariants; consider owning our own board representation if chess.js
fights back.

## R4 — WASM engine cost on real devices (performance risk)
Stockfish.wasm at depth 16, several times per turn, on a mid-range phone, in a
browser tab, alongside React. Memory and battery are the constraint, not CPU.

**Mitigation:** D9's shared-search design; measure on a real low-end device at
M1.3, not at M7. Have a hard fallback path: cap `d_max` by device class.

## R5 — Calibration is an unbounded time sink (schedule risk)
Parameter-heavy emergent systems can absorb months of tuning.

**Mitigation:** define acceptance bands and degeneracy detectors *before*
tuning (`docs/testing_strategy.md` §4), timebox M3 to one week, and accept
"non-degenerate and directionally correct" over "elegant."

## R6 — Licensing forecloses the highest-revenue path (business risk)
_Substantially retired by ADR 0006 (dual license, declared before any outside
contribution). The residual is dependency hygiene and Stockfish — see R10._
AGPL-3.0 plus outside contributors makes dual-licensing effectively impossible
later. See D16. Cheap to fix today, expensive-to-impossible in six months.

## R7 — Scope: four themes × four onboarding tracks (schedule risk)
The SRS specifies 4 visual themes, 4 audience manuals, narrator personas, match
audits, and campaign debriefs. That is a content pipeline, not a feature.

**Mitigation:** one theme through M6; treat the rest as post-MVP content work
with its own budget.

## R8 — Authored dialogue undercovers the situation space (product risk)
With no runtime LLM (ADR 0004), variety is bounded by what was written. Generic
lines ("The Rook is displeased.") or repetition within a single match reads as
cheapness — and ADR 0002 makes refusal cheap to trigger, so those lines will be
seen constantly.

**Mitigation:** author composable *fragments* conditioned on rich state
(grievance, target, repeat count) rather than whole sentences; CI coverage
validator over the tree; blind read-through before shipping. The retained
provider port makes the decision reversible if authoring cannot keep up.

## R10 — Stockfish is GPL-3.0 (legal risk, commercial track)
ADR 0006 commits to a dual license and ADR 0012 commits to Steam, but a GPL
engine cannot be linked into a proprietary build. Discovering this during
packaging would be expensive.

**Mitigation:** decide before Steam work begins — keep the engine in the AGPL
build only, isolate it behind a process boundary as a separate GPL component,
substitute a permissive engine, or sell content and support around an
AGPL-compliant binary. See `LICENSING.md`.

## R11 — Steam refunds versus a designed first-campaign loss (commercial risk)
ADR 0007 makes losing campaign 1 the intended experience, and ADR 0011 lets a
roster rout in minutes. On Steam, a player can refund inside two hours — which
is roughly the window in which the game is at its most punishing and least
explained.

**Mitigation:** the first hour must make *cause* legible even while the player
is losing; consider making campaign 1 short enough that the turn begins before
the refund window closes.

## R9 — Exec-lab claims outrun evidence (credibility risk)
Selling this as leadership *training* implies validity. There is no evidence yet
that in-game leadership behavior transfers to workplace behavior.

**Mitigation:** frame as a *discussion catalyst / experiential simulation*, not
an assessment instrument. Never produce a score that looks like a psychometric.

---

## Risk: the intended spiral reads as unfairness

ADR 0007 makes losing the first campaign the designed experience. The distance
between "this game taught me something" and "this game is broken" is entirely
legibility of cause: every trust loss must be attributable to a specific
player action in the audit, even though the *solution* is never disclosed.
Mitigation: grievance lines in piece dialogue from match 1, and a post-collapse
debrief that names the archetype the player enacted. This is the highest
refund-risk decision in the project and should be playtested before Milestone 7.

## Open questions (no owner yet)

1. ~~What happens when *every* legal move is refused?~~ **Answered** — the
   player may override any refusal at a steep trust cost (ADR 0014). Remaining
   sub-question is the price (D35).
2. Can the player negotiate — spend something (a promise, a protective escort,
   a share of victory) to buy compliance? A bargaining verb would make the trust
   economy two-sided instead of purely punitive. ADR 0014 gives the player a
   *coercive* answer to a refusal; a persuasive one would be its natural
   counterpart, and the contrast between them is most of the leadership content.
3. Do pieces gossip? Should `A_{i,j}` propagate second-hand ("the Rook told me
   what you did to the Pawn")? Cheap to implement, potentially the most
   organizationally realistic mechanic in the design.
4. Is there a draft/recruitment phase where the player chooses trait profiles,
   and does that reward min-maxing sycophants?
5. Should the *King* have psychology (i.e. does the player's avatar judge them)?
   Note the King is exempt from desertion (ADR 0003), but exemption from
   *leaving* is not the same as exemption from *feeling*.
6. Multiplayer: does the opponent see your roster's morale? Enormous
   information-warfare surface if yes — and D5 makes both armies psychological,
   so a leadership-vs-leadership match is now a coherent mode rather than a
   thought experiment.
7. ~~Does the campaign have a fail state?~~ **Yes** — ADR 0007 makes campaign
   collapse a supported terminal state, and the intended experience for a player
   who does not adapt. Open sub-question: how long phase 2 runs before it
   (D26), and whether there is a post-collapse epilogue (D29).
