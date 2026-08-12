import { calculateEngineSearchDepth } from '../../psychology/depth';
import { ENGINE_CONFIG } from '../../psychology/config';
import type { PendingVerdict } from '../../orchestration/matchSession';

export interface DivergenceDisplayProps {
  readonly pending: PendingVerdict;
}

export function DivergenceDisplay({
  pending,
}: DivergenceDisplayProps): JSX.Element {
  const own = pending.moveEval.deltaV_board;
  const leader = pending.moveEval.vLeaderImplied;
  const gap = leader - own;
  const searchDepth = calculateEngineSearchDepth(
    pending.actor.E_i,
    pending.actor.engagementFactor,
  );
  return (
    <div className="divergence">
      <h3>Evaluation divergence</h3>
      <p className="divergence__note">
        The piece reasons from depth {searchDepth} — not the true score (ADR
        0013). This gap is faith, not disloyalty.
      </p>
      <dl>
        <div>
          <dt>Piece view (depth {searchDepth})</dt>
          <dd>{own.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Commander implied</dt>
          <dd>{leader.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Faith gap</dt>
          <dd>{gap.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Perceived value</dt>
          <dd>{pending.outcome.perceivedValue.toFixed(2)}</dd>
        </div>
        <div>
          <dt>Refusal threshold</dt>
          <dd>{pending.outcome.refusalThreshold.toFixed(2)}</dd>
        </div>
      </dl>
    </div>
  );
}

export interface OverridePanelProps {
  readonly pending: PendingVerdict;
  readonly onOverride: () => void;
  readonly onReplan: () => void;
}

export function OverridePanel({
  pending,
  onOverride,
  onReplan,
}: OverridePanelProps): JSX.Element {
  return (
    <div className="override-panel" role="dialog" aria-modal="true">
      <h2>Refusal — override available</h2>
      <p>
        <strong>{pending.actor.role}</strong> refused <code>{pending.san}</code>
        . You may force the order or re-plan at no turn cost.
      </p>
      <DivergenceDisplay pending={pending} />
      <div className="override-panel__costs">
        <h3>Override cost preview</h3>
        <ul>
          <li>Trust to piece: {ENGINE_CONFIG.OVERRIDE_PIECE_TRUST_PENALTY}</li>
          <li>
            Witness trust: {ENGINE_CONFIG.OVERRIDE_WITNESS_TRUST_PENALTY} each
          </li>
        </ul>
      </div>
      <div className="override-panel__actions">
        <button type="button" className="btn btn--danger" onClick={onOverride}>
          Force {pending.san}
        </button>
        <button type="button" className="btn" onClick={onReplan}>
          Re-plan (free)
        </button>
      </div>
    </div>
  );
}

export interface RefusalPanelProps {
  readonly pending: PendingVerdict;
  readonly onReplan: () => void;
}

export function RefusalPanel({
  pending,
  onReplan,
}: RefusalPanelProps): JSX.Element {
  return (
    <div className="verdict-panel verdict-panel--refusal">
      <h2>Order refused</h2>
      <p>
        <strong>{pending.actor.role}</strong> will not play{' '}
        <code>{pending.san}</code>.
      </p>
      <DivergenceDisplay pending={pending} />
      <button type="button" className="btn" onClick={onReplan}>
        Issue a different order
      </button>
    </div>
  );
}

export interface DesertionPanelProps {
  readonly pending: PendingVerdict;
  readonly onAcknowledge: () => void;
}

export function DesertionPanel({
  pending,
  onAcknowledge,
}: DesertionPanelProps): JSX.Element {
  return (
    <div className="verdict-panel verdict-panel--desertion">
      <h2>Desertion</h2>
      <p>
        <strong>{pending.actor.role}</strong> walks off the board rather than
        play <code>{pending.san}</code>. Remaining pieces will re-evaluate.
      </p>
      <button type="button" className="btn btn--danger" onClick={onAcknowledge}>
        Acknowledge departure
      </button>
    </div>
  );
}

export interface QuietQuitPanelProps {
  readonly role: string;
  readonly san: string;
  readonly trust: number;
}

export function QuietQuitPanel({
  role,
  san,
  trust,
}: QuietQuitPanelProps): JSX.Element {
  return (
    <div className="verdict-panel verdict-panel--quiet-quit">
      <h2>Quiet compliance</h2>
      <p>
        <strong>{role}</strong> played <code>{san}</code> without enthusiasm.
        Trust is {trust}; engagement is low. The order went through — the army
        did not.
      </p>
      <p className="divergence__note">
        This is not a bug. The piece complied while withholding effort.
      </p>
    </div>
  );
}

export interface DialogueBubbleProps {
  readonly speaker: string;
  readonly line: string;
}

export function DialogueBubble({
  speaker,
  line,
}: DialogueBubbleProps): JSX.Element {
  return (
    <div className="dialogue-bubble">
      <div className="dialogue-bubble__speaker">{speaker}</div>
      <p>{line}</p>
    </div>
  );
}
