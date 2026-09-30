# Narrative

Authored, deterministic text (ADR 0004). No runtime LLM.

## The pack corpus (`packs/military/`)

ADR 0023 pack-as-data: every authored string the game needs lives in the
active pack as role-abstract JSON. Situation keys name relationships and
events, never board objects; themes re-skin `nounMap.json`, never the keys.

| File | Role |
|---|---|
| `pack.json` | Pack identity + file manifest |
| `nounMap.json` | Leader title, role nouns/epithets, domain/event/verdict/stage nouns — the schema every future pack must cover |
| `names.json` | Squad name pool for roster bootstrap |
| `dialogue.json` | Situation matrix — stems with `{role}` / `{san}` placeholders |
| `intros.json` | Narrator introductions — act × mandate band × variants (variant 0 is canonical) |
| `epilogues.json` | Terminal epilogues — default + per-act variants + dismissal's two readings (ADR 0022 §6) |
| `notices.json` | Fixed communications — `{title, body}` with `{name}`/`{role}`/`{act}`/`{seed}` placeholders, rendered via `renderNotice` |
| `commendations.json` | Award label + behavioural citation per commendation id (D90 — never a disposition) |
| `dialogueTree.generated.json` | Expanded tree regenerated from `dialogue.json` by the distill script |

```bash
pnpm dialogue:distill   # rewrite dialogueTree.generated.json
pnpm dialogue:check     # fail CI-style if generated file is stale
pnpm trait-leakage:check # scan every pack JSON for banned disposition phrasing
```

Edit stems in `packs/military/dialogue.json`, run distill. `dialogueTree.ts`
expands the pack at module load — the JSON is the single source of truth.
Review is human; the script only expands roles, it does not invent lines.

## Situation keys (ADR 0023)

`event.situation` — refusal/override/desertion/quiet_quit/compliant/heroic/rout
/dismissal events map to keys via `situationFor` in `authoredProvider.ts`.
Desertions carry a `grievance` (after_override / after_casualty / despair)
derived from the event log so every departure names an actable cause
(ADR 0018). Every key must hold ≥ 20 expanded variants (`coverage.ts`).
