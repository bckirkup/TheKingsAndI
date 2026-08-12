# Persistence

Dexie-backed local storage for careers, campaigns, rosters, and match records.

## Schema (v1)

| Table | Purpose |
|---|---|
| `careers` | Top-level career with seed and act list |
| `acts` | King appointment within a career (schema carries three) |
| `campaigns` | Match loop within an act |
| `matches` | Full event log + audit fold per match |
| `pieceIdentities` | Persistent piece names and provenance |
| `pieceStates` | Current roster psychology + status |
| `settings` | Schema version stamp |

## Folds

Audits, culture drift, commendations, learning delta, and certificates are
**never stored as authoritative counters** — they are recomputed from the event
log (`foldMatchAudit`, `foldCampaignCultureDrift`, `foldPlayerCommendations`,
transcript folds).

Commendation thresholds live in `commendationConfig.ts` and must keep golden +
sensitivity coverage (`tests/commendations.test.ts`).

## World types

`worldTypes.ts` scaffolds ADR 0047 persistent commanders. The headless world
loop lives under `sim/world.ts`; Dexie does not yet own a full seminar host
schema.

## Usage

```typescript
import { CareerRepository } from '../persistence';

const repo = new CareerRepository();
await repo.init();

const active = await repo.loadActiveCampaign();
// or repo.createCareer({ seed, roster, identities })
```
