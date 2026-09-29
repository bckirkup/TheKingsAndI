# Static text inventory

Every place the project needs pre-authored text, and where that text now lives.
Rule (ADR 0004): the shipped package never calls a model — every string below
is committed data, expanded and selected deterministically.

## In-world text (pack corpus — `src/narrative/packs/military/`)

| Text | File | Consumer | Status |
|---|---|---|---|
| Dialogue stems (16 situation keys × ≥7 stems × 6 roles) | `dialogue.json` | `dialogueTree.ts` → `lineFor` in MatchScreen | Live |
| Situation coverage (≥20 expanded/key) | `dialogueTree.generated.json` | `coverage.ts` CI check | Live |
| Narrator introductions (act × mandate × 3 variants) | `intros.json` | `narratorIntro`, `narratorIntroVariants` | Live |
| Terminal epilogues (5 × default+acts, dismissal ×2 readings) | `epilogues.json` | `epilogueFor`, `EPILOGUE_BY_TERMINAL`, DebriefScreen | Live |
| Fixed communications (dismissal, suspension, reinstatement, career end, retirement, grace, free-agent decline, promotion, certificate, panels) | `notices.json` | `noticeFor`/`renderNotice` (narrative/notices.ts); screens land per notice | Data (accessible) |
| Commendation labels + citations (8 player, 4 facilitator) | `commendations.json` | `PLAYER_LABELS`, `commendationCitation` | Live |
| Squad name pool (48) | `names.json` | `SQUAD_NAMES` in careerBootstrap | Live |
| Noun map (leader/roster/roles/domain/events/verdicts/stages) | `nounMap.json` | `NOUN_MAP`; the schema future packs must cover | Data (accessible) |

## Authored prose (TS constants, presentation-only per ADR 0001)

| Text | File | Notes |
|---|---|---|
| Audit headlines + outcome clauses | `src/narrative/audit.ts` | `OUTCOME_HEADLINE`/`OUTCOME_CLAUSE`, `matchAuditProse`, `campaignDebriefProse`, `channelReading`, `triggerClause` (desertion cause), `cascadeFindings`, `sacrificeFinding` |
| Credence bands | `src/narrative/authoredProvider.ts` | `credenceBand`, `trustBand`, deterministic `pickVariant` |
| Trait-leakage scan phrases | `src/narrative/traitLeakage.ts` | The banned disposition list — CI over all pack JSONs |

## UI copy (JSX — stays with its components)

| Text | File |
|---|---|
| Refusal/override/desertion/quiet-quit panels + divergence explainer | `src/ui/panels/VerdictPanels.tsx` |
| Phase labels, succession coda, rout panel | `src/app/MatchScreen.tsx` |
| Campaign hub tagline, suspension notice, reinstatement offer | `src/app/CampaignHub.tsx` |
| Debrief section headers, certificate button | `src/app/DebriefScreen.tsx` |

Panel and screen copy is keyed, canonical text — candidates to converge into
`notices.json` as screens land (the pack already holds the canonical notices).

## Human-facing documents (`docs/`)

| Text | File |
|---|---|
| Facilitator kit (opening script, closing script, debrief template, cohort narrative template) | `docs/facilitator/` |
| Pack onboarding manuals (military, medieval, corporate, classic/purist) | `docs/onboarding/` |
| This inventory | `docs/text_inventory.md` |

## Situation keys

`event.situation`, assigned by `situationFor` in `authoredProvider.ts`:

- `refusal.low_trust`, `refusal.expendable`, `refusal.able_uncared`, `refusal.no_faith`
- `override.forced`, `override.able_uncared`
- `desertion.mutiny`, `desertion.after_override`, `desertion.after_casualty`, `desertion.despair`
- `quiet_quit.compliance`
- `compliant.order`, `compliant.fatalistic`
- `heroic.sacrifice`
- `rout.cascade`
- `dismissal.censure`
