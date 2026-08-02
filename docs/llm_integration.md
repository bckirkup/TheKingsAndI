# Narration — authored personality, no runtime LLM

_Decided: **D11 personality only**, distilled where possible from a large model
into a decision tree; **D12 simplest possible approach first** (ADR 0004).
The shipped game makes no model calls, holds no API key, and needs no network._

---

## 1. Provider port

The port survives, because a BYO-key provider may be added later. What changes
is that the shipped configuration has exactly one implementation.

```ts
interface NarrationProvider {
  pieceLine(ctx: PieceLineContext): string;         // sync — no network
  narratorIntro(ctx: MatchIntroContext): string;
  matchAudit(ctx: MatchTelemetry): AuditProse;
  campaignDebrief(ctx: CampaignTelemetry): DebriefProse;
}
```

- `AuthoredProvider` — **the only shipped implementation.** A deterministic
  decision tree over `(verdict, event, persona, trustBand, affinityBand,
  grievanceKind, repeatCount)` with a seeded pick among leaf variants. Same
  match, same seed, same dialogue, byte for byte.
- `LlmProvider` — not shipped. Kept as a port so the decision is reversible
  without touching the core. If it ever ships, it decorates `AuthoredProvider`
  and falls back to it silently.

Note the signatures are **synchronous**. There is no await, no loading state, no
"the model is thinking," and no way for narration to desynchronize from state.

## 2. Distillation is a build step, not a runtime

A large model is an *authoring tool*, used offline:

```
authoring corpus  ──► LLM (offline, developer machine)  ──► reviewed lines
       │                                                        │
       │  situation matrix: verdict × grievance × persona ×      ▼
       │  trust band × relationship × repeat count        dialogue-tree JSON
       │                                                        │
       └──────────── committed to the repo ◄────────────────────┘
```

Rules:

1. Generated lines are **reviewed and committed as data**, exactly like art
   assets. The tree is in version control; its generation script is too.
2. The tree is a build input, not a network dependency. CI validates coverage —
   every reachable situation has at least one line, and no leaf is empty.
3. Regeneration is a deliberate, reviewable diff. Nobody ships prose nobody read.

### Coverage is the product risk
The interesting situations are combinatorial: which grievance, about which peer,
for the how-manyth time, at what trust band. Undercover it and pieces repeat
themselves within one match, which reads as cheapness. The mitigation is to
condition leaves on **rich state** and to author *fragments* that compose
(grievance + target + intensity) rather than whole sentences.

Priority order for authoring, by narrative weight:

1. Desertion — the irreversible act; every departure needs a specific reason.
2. Refusal — the most frequent player-facing verdict (ADR 0002 makes it cheap
   to trigger, so it will be seen constantly and must not repeat).
3. Witnessed sacrifice and its gratitude/contempt shifts.
4. Quiet quitting — must be *detectable in the prose* without being announced.
5. Match audit and campaign debrief.

## 2b. Situation keys are role-abstract (D52, resolved by ADR 0023 §4)

Every line the game will ever say is keyed on the situation key, so it bounds
what a piece can ever express, and changing it invalidates all authored content.
Two rules, both now settled:

1. Keys carry the two credence channels **separately** (ADR 0019), or a piece can
   never say *"I know it was right, I just don't think you care"* — the most
   valuable sentence in the design.
2. Keys name **relationships and events, never board objects**:

```
BAD   pawn_refused_diagonal_advance_after_capture
GOOD  subordinate.refused.high_risk_order.after_betrayal_by_this_leader
```

That is what allows a content pack to rename Pawn → Analyst for the exec-lab
track as data (D53) instead of forking the codebase. Pack coverage over reachable
keys is a CI check.

## 3. Legibility is a hard requirement, not flavor

ADR 0007 and ADR 0011 make losing — and the rout — intended experiences. The
only thing separating that from a bug report is that the player can reconstruct
*why*. Therefore:

- Every trust loss, refusal, and desertion carries a stated grievance that names
  the specific player action that caused it.
- The audit reconstructs causal chains ("Aldric left after you spent Maren;
  three more followed within two moves").
- Prose never discloses the *strategy* (D28 — discovery is the mechanic), but it
  always discloses the *cause*.

## 4. Safety & robustness

1. **Prompt injection is not a runtime concern** — there is no runtime prompt.
   It *is* an authoring-time concern: never feed player-supplied piece names into
   the offline authoring model.
2. **Player-supplied names** are sanitized (control chars stripped, length
   capped) and substituted into tree leaves as data, rendered as text, never HTML.
3. **Tone guardrails per persona** are enforced at authoring time by review
   (D17). The exec-lab persona needs a reviewed safe-mode subset of the tree.
4. **No keys, anywhere.** No key storage, no key UI, no key in logs, because
   there is no key.
5. **Offline parity is total** — the game has no online mode to be at parity
   with, and the 1,000-match harness needs no "LLM off" switch.

## 5. If the authored tree proves insufficient

The escape hatch, in order: enrich the conditioning state (cheap); author more
fragments (linear cost); regenerate the tree with a better authoring prompt
(cheap); and only then reconsider a runtime provider behind the retained port —
which would reopen ADR 0004 and reintroduce keys, cost, latency, and
non-determinism. The bar for that reversal should be high.
