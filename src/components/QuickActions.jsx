// Follow-up quick-action chips shown under the latest Fintly Pro answer —
// one-tap ways to get more value out of the same answer, similar to (and
// beyond) what ChatGPT offers.
const ACTIONS = [
  { label: 'Explain simpler', prompt: 'Can you explain your previous answer in much simpler terms, like I\'m new to this topic?' },
  { label: 'Make it shorter', prompt: 'Please summarize your previous answer in a few short bullet points.' },
  { label: 'Quiz me on this', prompt: 'Create a short 5-question quiz (with an answer key) based on what you just explained.' },
  { label: 'Translate to Hindi', prompt: 'Please translate your previous answer into Hindi.' },
];

export default function QuickActions({ onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 4 }}>
      {ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onPick(a.prompt)}
          style={{
            fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 20, padding: '6px 12px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; e.currentTarget.style.color = 'var(--ink)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}
