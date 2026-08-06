import type { DialogueTree } from '../tree';

/**
 * The authoring corpus — the reviewed source the shipped dialogue tree is
 * generated from. A large model is only ever an *authoring tool* used offline
 * (ADR 0004 §2); this file is the human-reviewed result, committed as data.
 * `authoring/generate.ts` composes it into `data/dialogue-tree.json`, and that
 * regeneration is a reviewable diff.
 *
 * Fragments are authored, not sentences: a line is `attitude + ability colour +
 * benevolence colour + grievance`, each a standalone clause so composition never
 * has to fix capitalisation. `{target}` and `{targetRole}` are substituted with
 * sanitized data at render time.
 *
 * Authoring priority (by narrative weight): desertion, refusal, witnessed
 * sacrifice, quiet quitting, then the positive verdicts.
 */
export const CORPUS: DialogueTree = {
  version: 1,
  nounMap: {
    K: 'king',
    Q: 'queen',
    R: 'rook',
    B: 'bishop',
    N: 'knight',
    P: 'pawn',
  },
  personas: {
    plainspoken: {
      attitudeCore: {
        HEROIC_EXECUTION: [
          'Gladly — watch this.',
          'For the win. Give the word.',
          'This is what I am for.',
        ],
        COMPLIANT_EXECUTION: ['Understood.', 'As ordered.', 'It is done.'],
        FATALISTIC_COMPLIANCE: [
          'I will go.',
          'Pin my name to my coat, then. I am going.',
          'It will be done. Do not pretend it is a good order.',
        ],
        QUIET_QUITTING: [
          'If you say so.',
          'Sure. Whatever you want.',
          'Fine. I will move.',
        ],
        MORAL_REFUSAL: [
          'No.',
          'I will not do that.',
          'Find another piece for that.',
        ],
        DESERTION_MUTINY: [
          'I am done. I am walking.',
          'Find someone else — I am leaving the board.',
          'No more. I am gone.',
        ],
      },
      abilityClause: {
        LOW: [
          'I do not even think it is the right call.',
          'It is not even a good move.',
        ],
        MID: [''],
        HIGH: [
          'I know it is the right move.',
          'The move is correct, I will grant you that.',
        ],
      },
      benevolenceClause: {
        LOW: [
          'I just do not think you care what it costs me.',
          'You have never cared what it does to us.',
        ],
        MID: [''],
        HIGH: [
          'You would pull me out if you could — I know that.',
          'You have earned that much from me.',
        ],
      },
      grievanceClause: {
        NONE: [''],
        ABANDONED: [
          'You left me hanging out there for three moves.',
          'You walked off and left me exposed.',
        ],
        SPENT_PEER: [
          'You spent {target} to buy a square.',
          'You threw {target} away.',
        ],
        OVERRIDDEN: [
          'You overrode me in front of everyone.',
          'You forced my hand and made them all watch.',
        ],
        NEGLECTED: [
          'You have never once asked what I saw.',
          'You have never covered me, not once.',
        ],
        CLASS_CONTEMPT: [
          'You spend {targetRole}s like they cost nothing.',
          'To you a {targetRole} is furniture.',
        ],
        LOSING_STREAK: [
          'We keep losing, and you keep asking the same of me.',
          'How many more times do we lose before you change?',
        ],
      },
      intro: {
        LOW: [
          'The room has already made up its mind about you. Prove it wrong, or do not.',
          'They will move the pieces. Do not mistake that for faith.',
        ],
        MID: [
          'They will follow. For now.',
          'The board is set. They are watching how you open.',
        ],
        HIGH: [
          'They would walk into fire for you. Do not waste it.',
          'You have their trust. Spend it like it can run out.',
        ],
      },
    },
  },
};
