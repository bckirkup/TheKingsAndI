# ADR 0010 — The public name is *The Kings and I*

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D18)
- **Date:** 2026-07-26

## Decision
The product is **The Kings and I: Sacrifice and Command**.

The plural and the subtitle are the trademark mitigation, and the subtitle is
also the tagline, so the store name and the pitch are the same words. "Living
Chess" is demoted to an internal codename for the mechanical concept and should
not appear in player-facing surfaces. Tonal reference point: *One Night in
Bangkok* — the chess-as-spectacle, arrogant-grandmaster register, not high
fantasy.

## Consequences
- README, UI copy, and store pages use *The Kings and I*. The repository was
  renamed in place `TheKingAndI` → `TheKingsAndI`; GitHub redirects the old URL,
  so existing clones and links keep working. The filename of this ADR
  (`0010-naming-the-king-and-i.md`) is left alone to keep inbound links stable.
- The title carries the thesis for free: the pieces you command are sovereigns
  in their own right, and the question of the whole game is who is really in
  command of whom.
- Existing planning documents keep "Living Chess" only where they quote the SRS.
- **The plural and the subtitle distinguish; they do not immunize.** *The King
  and I* is a Rodgers & Hammerstein musical with an actively enforced mark. The
  operative question is likelihood of confusion as to origin, and pluralizing to
  *The Kings and I* further reduces it: the mark is no longer identical to the
  musical's, and "Sacrifice and Command" plus chess imagery in the games class
  makes a confusion argument harder still to sustain — but the plural and the
  subtitle are mitigations, not a clearance.
- Two practical consequences: Steam store search will still surface the musical
  (an SEO problem more than a legal one), and a knockout search on the combined
  mark should happen **before the store page, not before the code**. Nothing in
  the codebase blocks on it.
- Use the full name in store and marketing contexts; the short form is fine
  in-product and in the repo.
