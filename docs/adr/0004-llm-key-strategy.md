# ADR 0004 — Narration delivery: no runtime LLM

- **Status:** accepted — owner decision, 2026-07-26 (design_decisions.md D11, D12)
- **Date:** 2026-07-26

## Context
A hosted shared API key is the best UX but forces a backend, rate limiting, abuse
handling, and per-user cost. BYO key keeps costs at zero but adds friction and
exposes a key in the client. The owner's ruling on D11 is that the LLM supplies
*personality only* and, to the extent possible, should be **distilled away from a
big model into a decision tree**; on D12, start with the simplest possible
approach and build from there.

## Decision
1. **No runtime LLM in the shipped game.** No API keys, no proxy, no backend.
2. Personality content is authored offline — a large model may be used as an
   *authoring tool* — and compiled into a deterministic decision tree / template
   bank that ships in the bundle.
3. The `NarrationProvider` port stays in place so a BYO-key provider can be added
   later without touching the core, if authored prose proves insufficient.

## Consequences
- The strongest possible form of ADR 0001: narration cannot affect game state
  because at runtime there is no model to ask.
- Everything stays offline, free, instant, and byte-reproducible; the 1,000-match
  harness needs no special "LLM off" mode because there is no on.
- Content becomes a production cost rather than an inference cost: the tree must
  cover grievances, refusals, desertions, and audits across every piece
  archetype. Distillation quality is now a product risk (`docs/llm_integration.md`).
- Dialogue variety is bounded by what was authored. Mitigation: condition tree
  nodes on rich state (which grievance, which peer, how many times) so lines feel
  specific rather than random.

## Alternatives considered
BYO key (friction, key exposure, still non-deterministic); hosted proxy (backend,
cost, abuse surface); shipping templates and selling LLM narration as an upgrade
(still possible later via the retained port).
