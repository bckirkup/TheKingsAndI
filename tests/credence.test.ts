import { describe, expect, it } from 'vitest';

import {
  checkInCredence,
  checkOutCredence,
  dispositionForIdentitySeed,
} from '../src/orchestration';
import {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
} from '../src/psychology';
import {
  exportPiecePassport,
  importPiecePassport,
  type PieceIdentityRecord,
  type StoredPieceState,
} from '../src/persistence';

function makePiece(): StoredPieceState {
  return {
    ...normalizePieceState({
      id: 'w:Pawn:00',
      role: 'Pawn',
      traits: {
        w_honor: 0.5,
        w_courage: 0.5,
        w_ambition: 0.5,
        w_loyalty: 0.5,
        w_empathy: 0.5,
        w_prestige: 0.5,
      },
      E_i: 50,
      T_i: 50,
      M_i: 50,
      B_i: 12,
      dyadicAffinity: {},
      classPrestige: {
        Pawn: 0,
        Knight: 0,
        Bishop: 0,
        Rook: 0,
        Queen: 0,
        King: 0,
      },
      engagementFactor: 1,
      credence: defaultCredence(),
      rumor: defaultRumor(),
    }),
    status: 'ACTIVE',
  };
}

function makeIdentity(): PieceIdentityRecord {
  return {
    id: 'w:Pawn:00',
    name: 'Aethelgard',
    bornInMatch: 0,
    originRole: 'Pawn',
    identityCreationSeed: 123,
    disposition: dispositionForIdentitySeed(123),
    relationshipAccounts: {},
  };
}

describe('credence channels', () => {
  it('keeps commander accounts divergent and leaves damage global', () => {
    const piece = makePiece();
    const identity = makeIdentity();
    const commanderA = checkInCredence(identity, 'leader:a', {
      ...piece,
      credence: { tauAbil: 20, tauBenev: 30, abilityObservationCount: 2 },
    });
    const commanderB = checkInCredence(commanderA, 'leader:b', {
      ...piece,
      credence: { tauAbil: 80, tauBenev: 70, abilityObservationCount: 4 },
    });

    expect(checkOutCredence(commanderB, 'leader:a', piece).credence).toEqual({
      tauAbil: 20,
      tauBenev: 30,
      abilityObservationCount: 2,
    });
    expect(checkOutCredence(commanderB, 'leader:b', piece).credence).toEqual({
      tauAbil: 80,
      tauBenev: 70,
      abilityObservationCount: 4,
    });
    expect(checkOutCredence(commanderB, 'leader:a', piece).B_i).toBe(12);
  });

  it('round-trips disposition and relationship accounts through a passport', () => {
    const piece = makePiece();
    const identity = checkInCredence(makeIdentity(), 'leader:a', {
      ...piece,
      credence: { tauAbil: 21, tauBenev: 63, abilityObservationCount: 5 },
    });
    const passport = exportPiecePassport({ piece, identity });
    const imported = importPiecePassport(passport);

    expect(imported).not.toBeNull();
    expect(imported?.identity).toEqual(identity);
  });

  it('derives disposition independently of encounter order', () => {
    const first = dispositionForIdentitySeed(456);
    const second = dispositionForIdentitySeed(456);
    expect(first).toEqual(second);
    expect(dispositionForIdentitySeed(789)).toEqual(
      dispositionForIdentitySeed(789),
    );
    const piece = makePiece();
    const identity = makeIdentity();
    const firstOrder = checkInCredence(
      checkInCredence(identity, 'leader:a', {
        ...piece,
        credence: { tauAbil: 11, tauBenev: 22, abilityObservationCount: 1 },
      }),
      'leader:b',
      {
        ...piece,
        credence: { tauAbil: 33, tauBenev: 44, abilityObservationCount: 2 },
      },
    );
    const secondOrder = checkInCredence(
      checkInCredence(identity, 'leader:b', {
        ...piece,
        credence: { tauAbil: 33, tauBenev: 44, abilityObservationCount: 2 },
      }),
      'leader:a',
      {
        ...piece,
        credence: { tauAbil: 11, tauBenev: 22, abilityObservationCount: 1 },
      },
    );
    expect(firstOrder.relationshipAccounts).toEqual(
      secondOrder.relationshipAccounts,
    );
  });
});
