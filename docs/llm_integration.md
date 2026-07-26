# Narration & LLM Integration

_Planning document. Invariant: narration is presentation-only (`design_decisions.md`
D11). No LLM output ever re-enters game state._

---

## 1. Provider port

```ts
interface NarrationProvider {
  pieceLine(ctx: PieceLineContext): Promise<string>;
  narratorIntro(ctx: MatchIntroContext): Promise<string>;
  matchAudit(ctx: MatchTelemetry): Promise<AuditProse>;
  campaignDebrief(ctx: CampaignTelemetry): Promise<DebriefProse>;
}
```

Two implementations:

- `TemplateProvider` — deterministic, offline, always available, and the
  **default**. Selection is a pure function of
  `(verdict, event, persona, trustBand, affinityBand)` plus a seeded pick among
  variants, so the same match replays with the same dialogue.
- `LlmProvider` — wraps a provider-agnostic HTTP adapter (Gemini 2.5 Flash or
  Claude Haiku; structured-JSON mode required). Wraps `TemplateProvider` and
  falls back to it on timeout, invalid schema, or refusal.

The UI renders the template line immediately and swaps in LLM prose if it
arrives within the budget. The player never waits on the network to move.

## 2. Context contracts

Prompt inputs are **projections of the event log**, assembled by a dedicated
`narrative/context` module — never raw internal state. This keeps the prompt
surface stable when psychology internals change, and keeps secrets/derived
values (e.g. the engine's true evaluation) out of prose the player shouldn't see.

Per-call context budgets (hard caps, enforced by the assembler):

| Call | Cap |
|---|---|
| `pieceLine` | ≤ 400 tokens in, ≤ 60 out |
| `narratorIntro` | ≤ 700 in, ≤ 150 out |
| `matchAudit` | ≤ 1,500 in, ≤ 500 out |
| `campaignDebrief` | ≤ 3,000 in, ≤ 900 out |

Schemas follow the SRS §6.2–6.5 examples; each has a Zod validator, and
validation failure means fallback, never a crash and never a retry storm.

## 3. Cost model (why templates are the default)

Assume ~40 plies/match and a line for every ply plus intro and audit:

| Mode | Calls/match | Rough cost/match | Cost per 20-match campaign |
|---|---|---|---|
| Templates only | 0 | $0 | $0 |
| LLM on notable plies only (verdict ≠ COMPLIANT, ~8/match) + intro + audit | ~10 | fractions of a cent | ~cents |
| LLM every ply | ~42 | several × above | noticeable at scale |

Conclusion: gate LLM calls on *narrative salience* (refusals, sacrifices,
mutinies, class shifts, turning points), not on every move. Cache by prompt hash;
identical situations reuse prose.

## 4. Safety & robustness

1. **Prompt injection:** piece names are user-supplied. Sanitize (strip control
   chars, cap length, escape delimiters) and pass names in a structured JSON
   field, never interpolated into the system prompt.
2. **Output containment:** prose is rendered as text, never HTML; no
   tool/function calling; no model output parsed into numbers.
3. **Tone guardrails per persona:** the exec-lab persona needs a "safe mode"
   (`design_decisions.md` D17) since simulated resentment can produce lines a
   corporate facilitator would not want on screen.
4. **Key handling:** BYO key stored in IndexedDB, never committed, never logged,
   masked in the UI, with an explicit warning that a client-side key is visible
   to anyone with access to the device.
5. **Offline parity:** every LLM-produced surface has a template equivalent, so
   the game is fully playable and fully debriefable with the network off. This is
   also what makes the harness able to run 1,000 matches for free.
