# ADR 0041 — Stopping the seminar: a crisis worth watching

- **Status:** proposed, deferred to Milestone 5b
- **Resolves:** **D104** (when does a moment in one student's match become the
  cohort's business?)
- **Depends on:** ADR 0040 §9 (the menu is logged before it is resolved)
- **Related:** ADR 0027 (cohort-first), ADR 0029 (a world lives as long as its
  curriculum), ADR 0030 (the transcript is the artifact), ADR 0031
  (commendations are computed at debrief, never shown during play)

## Context

ADR 0040 turns a refusal into a crisis with a generated menu of ways out. Some
of those moments are ordinary and some are the reason the room is in the room:
the roster has just nominated a victim, or the only two live options are to
break a piece or to lose the position. In a seminar, a facilitator will want to
stop the class and put that board and that menu on every screen.

This ADR records the intent and the one constraint it imposes on work happening
now. The seminar, cohort, and multi-commander machinery is Milestone 5b and is
built separately; nothing here should be implemented before it.

## Decision

1. **Crises carry a teachable-moment score**, computed as a fold over the log:
   *rarity* (how seldom this option set has appeared across the cohort's corpus)
   × *consequence* (how much trust and board value are at stake) ×
   *decidability* (whether at least two live options carry genuinely opposing
   costs). A rare crisis that is rare because it is noise should not stop the
   room; a common one on which the cohort would split is worth stopping for.
2. **The pause happens before the choice, not after.** The cohort sees the
   board and the menu, predicts, and then watches what the commander does and
   what it costs. This is the whole pedagogical payoff and it is only possible
   because ADR 0040 §9 emits `CRISIS_MENU` before resolution.
3. **The threshold is not legible from inside a session.** If students learn
   that a nomination stops the room, they will farm the spotlight. The score
   rewards the *dilemma being present*, never the luridness of the option
   taken, and neither score nor threshold is surfaced in play — the same rule
   ADR 0031 §3 applies to commendations.
4. **Rarity needs a corpus.** Until a cohort has played enough crises to
   estimate it, rarity falls back to an authored prior over option sets shipped
   with the content pack. A first cohort must not be un-stoppable.
5. **Facilitator override.** The facilitator may stop the room at any moment
   regardless of score, and may decline a triggered stop. The score proposes;
   it never seizes the class.

## Consequences

- The single constraint on present work: `CRISIS_MENU` must be logged with its
  gate values before the commander acts. If ADR 0040 ships without that, this
  feature is not merely unbuilt but unbuildable from the archive, and every
  match played in the meantime is unusable as seminar material.
- The same quantity is a balance metric. **Dilemma-present rate** — the
  fraction of crises offering two live opposing options — measures playable
  space directly rather than inferring it from win rates, and would have
  reported "kindness is strictly optimal" without a nine-style sweep.
- Rarity is corpus-relative, so the same crisis stops one cohort and not
  another. That is intended; it is also a determinism boundary, and the score
  must therefore live outside match state and never influence play.

## Alternatives considered

- **Facilitator-only, no score.** Simplest, and it works — but it requires the
  facilitator to be watching the one screen where the interesting thing is
  happening, which is exactly what does not scale past a handful of students.
- **Stop on named events (every nomination).** Legible and immediately gamed,
  and it would stop the room on the tenth nomination as readily as the first.
- **Score after the fact and replay it at debrief.** Cheaper, and it loses the
  prediction — the thing that makes the room argue.
