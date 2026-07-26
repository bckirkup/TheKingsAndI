# Risks & Open Questions

_Ordered by expected damage. "Mitigation" names the milestone that retires it._

---

## R1 — The psychology model is not fun (design risk, highest)
Refusal and mutiny may read as *the game cheating* rather than as drama. Every
comparable system (Close Combat's suppression, RimWorld's mental breaks) works
because the player can see the cause coming and had agency to prevent it.

**Mitigation:** M3 calibration + M4 playtest with an explicit "was that fair?"
question; always expose the piece's reasoning and a pre-move risk preview
(`design_decisions.md` D4). If a refusal ever surprises the player, that is a
UX bug, not a feature.

## R2 — Chess integrity collapses (design + math risk)
Turn loss, frozen pieces, and defection all mutate the game tree. Refusals can
create zugzwang-like states not covered by chess.js's draw/stalemate rules; a
frozen piece changes stalemate detection ("all my legal moves are refused" — is
that a loss, a draw, or a forced null move?).

**Mitigation:** decide D2/D3 before M2; write explicit rules for
"no compliant legal move exists" and cover it with goldens. Suspect this edge
case will appear in real play more often than intuition suggests.

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
AGPL-3.0 plus outside contributors makes dual-licensing effectively impossible
later. See D16. Cheap to fix today, expensive-to-impossible in six months.

## R7 — Scope: four themes × four onboarding tracks (schedule risk)
The SRS specifies 4 visual themes, 4 audience manuals, narrator personas, match
audits, and campaign debriefs. That is a content pipeline, not a feature.

**Mitigation:** one theme through M6; treat the rest as post-MVP content work
with its own budget.

## R8 — LLM prose quality and cost drift (product risk)
Prose that is generic ("The Rook is displeased.") is worse than a good template.
Model deprecation and pricing changes are outside our control.

**Mitigation:** templates are the product baseline; LLM must beat them in a
blind read-through before shipping. Keep the provider adapter one file thick.

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

1. What happens when *every* legal move is refused? (see R2)
2. Can the player negotiate — spend something (a promise, a protective escort,
   a share of victory) to buy compliance? A bargaining verb would make the trust
   economy two-sided instead of purely punitive.
3. Do pieces gossip? Should `A_{i,j}` propagate second-hand ("the Rook told me
   what you did to the Pawn")? Cheap to implement, potentially the most
   organizationally realistic mechanic in the design.
4. Is there a draft/recruitment phase where the player chooses trait profiles,
   and does that reward min-maxing sycophants?
5. Should the *King* have psychology (i.e. does the player's avatar judge them)?
6. Multiplayer: does the opponent see your roster's morale? Enormous
   information-warfare surface if yes.
7. ~~Does the campaign have a fail state?~~ **Yes** — ADR 0007 makes campaign
   collapse a supported terminal state, and the intended experience for a player
   who does not adapt. Open sub-question: how long phase 2 runs before it
   (D26), and whether there is a post-collapse epilogue (D29).
