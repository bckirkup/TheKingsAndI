# Data Model & Persistence

_Planning document. Types are illustrative TypeScript, not yet implemented.
Field names and ranges follow `docs/spec/psychology-engine.reference.ts`, which
is normative; this document adds the persistence and identity layers around it._

---

## 1. Entities

```ts
type PieceId = string;          // uuid v4, immutable for the piece's whole life
type Role = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';

interface PieceIdentity {       // never changes
  id: PieceId;
  name: string;                 // "Aethelgard"
  bornInMatch: number;
  originRole: Role;             // role at creation (a promoted pawn keeps 'P' here)
  traits: TraitVector;          // Θ_i, immutable
}

interface PieceState {          // evolves; snapshot per match, persisted per campaign
  id: PieceId;
  role: Role;                   // current role (promotion mutates this)
  E_i: number;                  // experience, 1..100
  T_i: number;                  // trust in leader, -100..100
  M_i: number;                  // morale, 0..100
  B_i: number;                  // betrayal / disillusionment, 0..100
  dyadicAffinity: Record<PieceId, number>;      // A_{i,j}, sparse, asymmetric
  classPrestige: Record<Role, number>;          // C_{i,role}, PER PIECE
  status: 'ACTIVE' | 'CAPTURED' | 'DESERTED' | 'BENCHED' | 'FIRED';
}

interface Roster {
  id: string;
  campaignId: string | null;
  pieces: PieceId[];
  createdAt: number;
}

interface MatchRecord {
  id: string;
  campaignId: string | null;
  seed: number;                 // RNG seed — required for replay
  rosterSnapshot: PieceState[]; // state at match start
  intents: PlayerIntent[];      // what the player asked for, incl. refused asks
  events: MatchEvent[];         // canonical log; audits fold over this
  result: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED';
  engineConfig: { dMin: number; dMax: number; deterministic: boolean };
  psychConfigVersion: string;   // which ENGINE_CONFIG the match was played under
  schemaVersion: number;
}

interface CampaignRecord {
  id: string;
  matches: string[];            // MatchRecord ids, ordered
  cultureDrift: CultureDriftPoint[];   // one per match, derived + cached
  firings: { pieceId: PieceId; matchIndex: number }[];
}
```

**Class prestige is per piece, not per roster.** The reference implementation
stores `classPrestige` on each `PieceState` keyed by role, so every piece holds
its own prejudices and only updates them from events it witnessed. That is 6
integers × 16 pieces — trivial storage, and much better behavior than a shared
matrix (a Rook who never saw the sacrifice should not inherit the gratitude).
Engagement factor `η_i` is deliberately **not** persisted here: it is derived
from the most recent verdict (see `psychology_engine.md` §10.7).

## 2. Identity rules (decision-sensitive)

These three rules define the campaign's emotional stakes and must be settled
before Phase 1 code lands (see `docs/design_decisions.md` D6):

1. **Capture ≠ death?** Options: (a) permadeath with recruitment of green
   replacements; (b) pieces return next match carrying `B_i` trauma; (c) hybrid
   — return, but a piece captured *N* times becomes unrecruitable.
   Note `status` distinguishes `BENCHED` (reference: `T -= 30`) from `FIRED`
   (SRS: `T := -100`); whether both exist is part of this decision.
2. **Promotion:** a promoted pawn keeps `id`, `traits`, and all bonds, but its
   `role` changes → it now benefits from Queen-class prestige while remembering
   pawn-class solidarity. This is deliberately the most interesting narrative
   engine in the game and should not be simplified away.
3. **Roster size:** exactly 16, or a bench larger than 16 (making "who plays"
   itself a leadership decision, and making benching distinct from firing)?

## 3. Dexie schema (v1 draft)

```ts
db.version(1).stores({
  pieceIdentities: 'id',
  pieceStates:     'id, status',   // dyadicAffinity + classPrestige stored inline
  rosters:         'id, campaignId',
  matches:         'id, campaignId, schemaVersion',
  campaigns:       'id',
  settings:        'key',
});
```

Rules:

- **Never** store derived aggregates as the only copy: audits, drift vectors,
  and archetype classifications are folds over `matches[].events` and are cached
  with the fold's version tag so they can be invalidated on formula changes.
- Every record carries `schemaVersion`; migrations are forward-only and tested
  with fixture databases (`tests/fixtures/db-v*.json`).
- Blob budget: a 40-ply match log is a few KB; a 20-match campaign is well
  under 1 MB. No pruning needed at MVP, but cap event log growth from
  `PSYCH_DELTA` spam by batching per-ply deltas into one event per piece.

## 4. Roster export format (Phase 2)

Canonical JSON (sorted keys, no floats beyond 3 decimals) + detached Ed25519
signature. Purpose is *provenance for bragging rights*, not real anti-cheat —
a local-first client can always be tampered with. State that explicitly in the
UI rather than implying a security guarantee we cannot deliver.

```json
{
  "format": "living-chess/roster@1",
  "exportedAt": 1780000000,
  "publicKey": "base64...",
  "roster": { "...": "canonicalized Roster + PieceState[] + PieceIdentity[]" },
  "signature": "base64..."
}
```

## 5. Telemetry & privacy (exec-lab track)

- Default: **all data stays local.** No analytics, no account required.
- Exec-lab facilitators need export: a CSV/JSON debrief bundle per participant,
  produced client-side, with no names or emails collected by the app itself.
- If Phase 3 adds cloud sync, participant data must be opt-in per session and
  documented in a data-handling note — this materially affects whether the
  product can be sold into corporate/government training (see D12).
