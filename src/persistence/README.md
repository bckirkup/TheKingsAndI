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

Audits and culture drift are **never stored as authoritative counters** — they are
recomputed from the event log via `foldMatchAudit` and `foldCampaignCultureDrift`.

## Usage

```typescript
import { CareerRepository } from '../persistence';

const repo = new CareerRepository();
await repo.init();

const active = await repo.loadActiveCampaign();
// or repo.createCareer({ seed, roster, identities })
```
