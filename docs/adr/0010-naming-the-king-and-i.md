# ADR 0010 — The public name is *The King and I*

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D18)
- **Date:** 2026-07-26

## Decision
The product is **The King and I: Sacrifice and Command**.

The subtitle is the trademark mitigation and also the tagline, so the store name
and the pitch are the same words. "Living Chess" is demoted to an internal
codename for the mechanical concept and should not appear in player-facing
surfaces. Tonal reference point: *One Night in Bangkok* — the chess-as-spectacle,
arrogant-grandmaster register, not high fantasy.

## Consequences
- Repo name, README, UI copy, and store pages use *The King and I*.
- The title carries the thesis for free: the "I" is the sovereign, and the
  question of the whole game is who exactly is in that relationship with whom.
- Existing planning documents keep "Living Chess" only where they quote the SRS.
- **The subtitle distinguishes; it does not immunize.** *The King and I* is a
  Rodgers & Hammerstein musical with an actively enforced mark. The operative
  question is likelihood of confusion as to origin, and "Sacrifice and Command"
  plus chess imagery in the games class makes that argument hard to sustain —
  but this is a mitigation, not a clearance.
- Two practical consequences: Steam store search will still surface the musical
  (an SEO problem more than a legal one), and a knockout search on the combined
  mark should happen **before the store page, not before the code**. Nothing in
  the codebase blocks on it.
- Use the full name in store and marketing contexts; the short form is fine
  in-product and in the repo.
