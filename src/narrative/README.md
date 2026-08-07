# Narrative

Authored, deterministic dialogue (ADR 0004). No runtime LLM.

## Dialogue packs (Milestone 6.2)

| File | Role |
|---|---|
| `dialoguePack.json` | Situation matrix — stems with `{role}` / `{san}` placeholders |
| `dialogueTree.ts` | Runtime table used by `AuthoredProvider` |
| `dialogueTree.generated.json` | Expanded tree regenerated from the pack |

```bash
pnpm dialogue:distill   # rewrite dialogueTree.generated.json
pnpm dialogue:check     # fail CI-style if generated file is stale
```

Edit stems in `dialoguePack.json`, run distill, then keep `dialogueTree.ts` in
sync (or switch the provider to import the generated JSON). Review is human —
the script only expands roles; it does not invent lines.
