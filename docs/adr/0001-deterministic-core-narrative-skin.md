# ADR 0001 — Deterministic core, narrative skin

- **Status:** proposed (recommended; see design_decisions.md D11)
- **Date:** 2026-07-26

## Context
The design leans heavily on LLM prose (piece dialogue, narrator, audits,
campaign debriefs). LLMs are non-deterministic, rate-limited, paid, and
occasionally unavailable. The project also needs 1,000-match headless
calibration runs and byte-reproducible replays.

## Decision
All state-affecting computation (chess legality, utility, verdicts, trust,
affinity, class bias, engine depth allocation) is deterministic and pure given
`(state, intent, insight, seed)`. LLM output is presentation-only and is never
read back into game state. Templates are the default narration provider; the LLM
provider decorates it and falls back silently.

## Consequences
- Fully offline, zero-key playable build; free headless calibration.
- Golden-value and replay tests are possible at all.
- Emergent personality is bounded by our template/utility design rather than by
  model creativity — accepted cost.

## Alternatives considered
LLM-driven piece decisions: richer personality, but unbalanceable, untestable,
expensive per turn, and not offline-playable.
