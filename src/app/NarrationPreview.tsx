import {
  createAuthoredProvider,
  type MatchTelemetry,
  type PieceLineContext,
  type PieceRef,
} from '../narrative';

/**
 * A presentation-only preview of the Milestone 6 narration layer. It renders
 * authored lines and a match audit straight from `AuthoredProvider` — no game
 * state, no network, no model call (ADR 0001, ADR 0004). It exists so a human
 * can read the voice before the board (Milestone 4) is built.
 */

const provider = createAuthoredProvider();
const SEED = 20260806;

interface Scene {
  readonly label: string;
  readonly speaker: PieceRef & { readonly id: string };
  readonly context: PieceLineContext;
}

function scene(
  label: string,
  speaker: PieceRef & { readonly id: string },
  context: Omit<PieceLineContext, 'speaker' | 'seed' | 'persona'>,
): Scene {
  return {
    label,
    speaker,
    context: { ...context, speaker, persona: 'plainspoken', seed: SEED },
  };
}

const SCENES: readonly Scene[] = [
  scene(
    'Refusal — "right, but you don\'t care"',
    { id: 'r1', name: 'Roland', role: 'R' },
    {
      verdict: 'MORAL_REFUSAL',
      grievance: 'SPENT_PEER',
      credence: { ability: 'HIGH', benevolence: 'LOW' },
      affinity: 'CLOSE',
      target: { name: 'Maren', role: 'Q' },
      repeatCount: 0,
    },
  ),
  scene(
    'Desertion — the irreversible act',
    { id: 'n1', name: 'Isolde', role: 'N' },
    {
      verdict: 'DESERTION_MUTINY',
      grievance: 'ABANDONED',
      credence: { ability: 'MID', benevolence: 'LOW' },
      repeatCount: 0,
    },
  ),
  scene(
    'Fatalistic compliance — full effort, no faith',
    { id: 'b1', name: 'Aldwin', role: 'B' },
    {
      verdict: 'FATALISTIC_COMPLIANCE',
      grievance: 'OVERRIDDEN',
      credence: { ability: 'HIGH', benevolence: 'LOW' },
      repeatCount: 0,
    },
  ),
  scene(
    'Quiet quitting — detectable, never announced',
    { id: 'p1', name: 'Bram', role: 'P' },
    {
      verdict: 'QUIET_QUITTING',
      grievance: 'NEGLECTED',
      credence: { ability: 'LOW', benevolence: 'MID' },
      repeatCount: 0,
    },
  ),
  scene(
    'Class contempt — a rook on being spent like a pawn',
    { id: 'r2', name: 'Godfrey', role: 'R' },
    {
      verdict: 'MORAL_REFUSAL',
      grievance: 'CLASS_CONTEMPT',
      credence: { ability: 'MID', benevolence: 'LOW' },
      target: { name: 'Pip', role: 'P' },
      repeatCount: 0,
    },
  ),
  scene(
    'Heroic execution — the order lands well',
    { id: 'q1', name: 'Seraphine', role: 'Q' },
    {
      verdict: 'HEROIC_EXECUTION',
      grievance: 'NONE',
      credence: { ability: 'HIGH', benevolence: 'HIGH' },
      repeatCount: 0,
    },
  ),
];

const AUDIT_TELEMETRY: MatchTelemetry = {
  outcome: 'ROUT',
  plies: 58,
  overrides: 2,
  boardQuality: 74,
  executionFidelity: 41,
  departures: [
    {
      piece: { name: 'Aldric', role: 'P' },
      ply: 10,
      grievance: 'SPENT_PEER',
      triggeredBy: { name: 'Maren', role: 'Q' },
    },
    { piece: { name: 'Bram', role: 'R' }, ply: 11, grievance: 'LOSING_STREAK' },
    { piece: { name: 'Cade', role: 'N' }, ply: 12, grievance: 'LOSING_STREAK' },
  ],
};

const ROLE_NOUN: Record<PieceRef['role'], string> = {
  K: 'King',
  Q: 'Queen',
  R: 'Rook',
  B: 'Bishop',
  N: 'Knight',
  P: 'Pawn',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    padding: '3rem 1.5rem 4rem',
    background:
      'radial-gradient(circle at 20% -10%, #12324a 0%, #0a1622 55%, #060d16 100%)',
    color: '#dce6f0',
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxSizing: 'border-box',
  },
  shell: { maxWidth: 960, margin: '0 auto' },
  eyebrow: {
    letterSpacing: '0.32em',
    textTransform: 'uppercase',
    fontSize: 12,
    color: '#5fd0e0',
    margin: 0,
  },
  title: { fontSize: 40, margin: '0.35rem 0 0.25rem', fontWeight: 700 },
  lede: { color: '#93a6ba', maxWidth: 620, lineHeight: 1.5, marginTop: 0 },
  narrator: {
    borderLeft: '3px solid #5fd0e0',
    background: 'rgba(95, 208, 224, 0.06)',
    padding: '0.9rem 1.2rem',
    borderRadius: 6,
    fontStyle: 'italic',
    color: '#bcd2e4',
    margin: '2rem 0 2.5rem',
  },
  sectionLabel: {
    fontSize: 13,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#6f8398',
    margin: '0 0 1rem',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'rgba(148, 178, 208, 0.05)',
    border: '1px solid rgba(120, 150, 180, 0.18)',
    borderRadius: 10,
    padding: '1.1rem 1.2rem 1.3rem',
  },
  cardLabel: { fontSize: 12, color: '#5fd0e0', margin: '0 0 0.75rem' },
  speaker: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  speakerName: { fontWeight: 600, fontSize: 15 },
  speakerRole: { fontSize: 12, color: '#7f93a8' },
  line: { fontSize: 17, lineHeight: 1.45, color: '#eef4fb', margin: 0 },
  auditCard: {
    marginTop: '2.75rem',
    background: 'rgba(148, 178, 208, 0.05)',
    border: '1px solid rgba(120, 150, 180, 0.18)',
    borderRadius: 10,
    padding: '1.4rem 1.5rem 1.6rem',
  },
  auditHeadline: { margin: '0 0 0.9rem', fontSize: 22 },
  auditParagraph: { color: '#c3d3e4', lineHeight: 1.55, margin: '0 0 0.7rem' },
  finding: { color: '#dce6f0', lineHeight: 1.5, margin: '0.35rem 0' },
  footer: {
    marginTop: '2.5rem',
    color: '#5b6f83',
    fontSize: 12,
    lineHeight: 1.6,
  },
};

export function NarrationPreview(): JSX.Element {
  const intro = provider.narratorIntro({
    leaderName: 'You',
    persona: 'plainspoken',
    mandate: 'MID',
    act: 1,
    seed: SEED,
  });
  const audit = provider.matchAudit(AUDIT_TELEMETRY);

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <p style={styles.eyebrow}>The Kings and I · Milestone 6</p>
        <h1 style={styles.title}>The narration layer</h1>
        <p style={styles.lede}>
          The pieces speak from an authored, deterministic decision tree — no
          runtime model, no network, no keys. Every line names a cause the
          player can act on, and never repeats itself within a match.
        </p>

        <p style={styles.narrator} data-testid="narrator-intro">
          {intro}
        </p>

        <h2 style={styles.sectionLabel}>How an order is received</h2>
        <div style={styles.grid}>
          {SCENES.map((item) => (
            <article key={item.speaker.id} style={styles.card}>
              <p style={styles.cardLabel}>{item.label}</p>
              <div style={styles.speaker}>
                <span style={styles.speakerName}>{item.speaker.name}</span>
                <span style={styles.speakerRole}>
                  {ROLE_NOUN[item.speaker.role]}
                </span>
              </div>
              <p style={styles.line}>
                &ldquo;{provider.pieceLine(item.context)}&rdquo;
              </p>
            </article>
          ))}
        </div>

        <section style={styles.auditCard} data-testid="match-audit">
          <h2 style={styles.auditHeadline}>{audit.headline}</h2>
          {audit.paragraphs.map((paragraph) => (
            <p key={paragraph} style={styles.auditParagraph}>
              {paragraph}
            </p>
          ))}
          {audit.findings.map((finding) => (
            <p key={finding} style={styles.finding}>
              — {finding}
            </p>
          ))}
        </section>

        <p style={styles.footer}>
          Presentation only: nothing here is parsed into a number, stored as
          state, or fed back into psychology (ADR 0001). Lines are
          byte-identical under a fixed seed.
        </p>
      </div>
    </main>
  );
}
