---
name: narrative-llm
description: Implement or modify The King and I narration layer — the authored dialogue tree, narrator broadcasts, match audits, and campaign debriefs — without breaking determinism or offline play. There is no runtime LLM. Use when touching src/narrative/ or the dialogue tree.
---

# Narration Layer (authored dialogue tree, no runtime LLM)

## Testimony, not exposition (ADR 0018)

The player never sees the arithmetic. A piece's line is generated from its
**verdict**, not its computation, so it may rationalize — that is intended and
in character. The hard constraint is that every line must still name a **cause**
the player can act on ("you left me on that file"), because an unattributable
trust loss is the top refund risk in `docs/trust_dynamics.md`. Rationalization
is permitted; illegible cause is a bug.

## The two rules

1. Narration is **presentation-only**. It is never parsed into numbers, never
   stored as state, never fed back into psychology (ADR 0001). If a change makes
   prose affect a verdict, a delta, or a save file, the change is wrong.
2. **There is no model call at runtime, and no API key** (ADR 0004). A large
   model is an *authoring tool* used offline; the game ships a reviewed,
   committed decision tree.

## Structure

```
NarrationProvider  (port; synchronous — no promises, no loading states)
└── AuthoredProvider   the only shipped implementation
    └── dialogue-tree JSON, committed to the repo
(LlmProvider)          not shipped; the port exists to keep ADR 0004 reversible
```

Leaf selection is a pure function of
`(verdict, event, persona, trustBand, affinityBand, grievanceKind, repeatCount)`
plus a seeded variant pick, so replays reproduce dialogue byte for byte.

## Implementation rules

1. **Context assembly is its own module.** Lines are keyed off projections of the
   event log, never raw internal state. This keeps the narration surface stable
   when psychology internals change, and keeps hidden information (the engine's
   true evaluation) out of prose the player should not see.
2. **Author fragments, not sentences.** Compose grievance + target + intensity;
   whole-sentence leaves undercover the space and repeat within a match.
3. **Legibility of cause is mandatory.** Every refusal, trust loss, and desertion
   states the specific player action behind it. ADR 0007 and ADR 0011 make losing
   and routing intended experiences; an unexplained loss is a bug report.
   Disclose the *cause*, never the *strategy* (D28).
4. **Never disclose the solution.** Discovery across multiple campaigns is the
   mechanic.
5. **Sanitize player-supplied names** — strip control characters, cap length,
   substitute as data. Render as text, never HTML.
6. **Persona tone guardrails** are enforced at authoring-time review; the
   exec-lab persona needs a reviewed safe-mode subset (D17).
7. **Regenerating the tree is a reviewable diff.** The generation script lives in
   the repo; nobody ships prose nobody read.

## Authoring priority

Desertion first (the irreversible act — every departure needs its own reason),
then refusal (most frequently seen, since ADR 0002 makes it cheap to trigger),
then witnessed sacrifice, quiet quitting, and finally audit/debrief prose.

## Testing

Do not test prose content. Test the contract: coverage (no reachable situation
without a line, no empty leaves), no repetition within a match, determinism of
leaf selection under a fixed seed, name sanitization, and that the same
`(state, seed)` yields identical text. A snapshot suite over representative
situations is the only prose-level testing worth maintaining.
