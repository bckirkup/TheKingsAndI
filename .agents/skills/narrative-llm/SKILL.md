---
name: narrative-llm
description: Implement or modify the Living Chess narration layer — template dialogue, narrator broadcasts, match audits, campaign debriefs, and the optional LLM provider — without breaking determinism, offline play, or cost budgets. Use when touching src/narrative/ or prompt schemas.
---

# Narration Layer (templates + optional LLM)

## The one rule

Narration is **presentation-only**. LLM output is never parsed into numbers,
never stored as state, never fed back into psychology (ADR 0001). If a change
makes prose affect a verdict, a delta, or a save file, the change is wrong.

## Structure

```
NarrationProvider  (port)
├── TemplateProvider   default; deterministic; offline; always available
└── LlmProvider        decorates TemplateProvider; falls back to it on any failure
```

The UI renders the template line immediately and swaps in LLM prose only if it
arrives within budget. The player never waits on the network to move a piece.

## Implementation rules

1. **Context assembly is its own module.** Prompts are built from projections of
   the event log, never from raw internal state. This keeps prompts stable when
   psychology internals change, and keeps hidden information (the engine's true
   evaluation) out of prose the player should not see.
2. **Validate output with a schema** (Zod). Invalid → fall back to template
   silently. No retry storms; a missing line is invisible, a stalled turn is not.
3. **Gate calls on narrative salience.** Refusals, sacrifices, mutinies, class
   shifts, and turning points — roughly 8 of 40 plies. Not every move.
4. **Cache by prompt hash.** Identical situations reuse prose.
5. **Sanitize user-supplied names.** Piece names are player text: strip control
   characters, cap length, pass in a structured JSON field, never interpolate into
   the system prompt. Render prose as text, never HTML. No tool calling.
6. **Respect the token caps** in `docs/llm_integration.md` §2 and enforce them in
   the assembler, not by hoping the model is brief.
7. **Persona tone guardrails.** The exec-lab persona needs a safe mode; simulated
   resentment can produce lines a corporate facilitator will not want on screen.
8. **Keys are never logged or committed.** BYO key lives in IndexedDB, masked in
   the UI, with an explicit warning that it is visible on the device.

## Templates are the product, not the fallback

The game must be fully playable, fully narratable, and fully debriefable with the
network off — that is also what makes 1,000-match calibration runs free. Before
shipping LLM prose, do a blind read-through against templates; if the LLM does
not clearly win, ship templates and save the money.

Template selection is a pure function of
`(verdict, event, persona, trustBand, affinityBand)` plus a seeded variant pick,
so replays reproduce dialogue exactly.

## Testing

Do not test prose content. Test the contract: schema validation, name
sanitization, timeout behavior, silent fallback, cache hits, and token-cap
enforcement. A cassette (recorded-response) snapshot suite is the only
prose-level testing worth maintaining.
