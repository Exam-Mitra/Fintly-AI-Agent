const SUGGESTIONS = [
  {
    icon: '💡',
    title: 'Explain a concept',
    prompt: 'Explain how neural networks work, in simple terms with an analogy.',
  },
  {
    icon: '🔍',
    title: 'Research something',
    prompt: 'What are the latest developments in renewable energy storage?',
  },
  {
    icon: '💻',
    title: 'Write code',
    prompt: 'Write a Python script that renames all files in a folder to lowercase.',
  },
  {
    icon: '✍️',
    title: 'Draft something',
    prompt: 'Write a polite follow-up email after a job interview.',
  },
];

export default function SuggestionCards({ onPick }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
      maxWidth: 560, margin: '28px auto 0', padding: '0 4px',
    }}>
      {SUGGESTIONS.map((s) => (
        <button
          key={s.title}
          onClick={() => onPick(s.prompt)}
          style={{
            textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 14, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 6,
            transition: 'border-color 0.15s ease, transform 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-blue)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          <span style={{ fontSize: 18 }}>{s.icon}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{s.title}</span>
          <span style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.4 }}>{s.prompt}</span>
        </button>
      ))}
    </div>
  );
}
