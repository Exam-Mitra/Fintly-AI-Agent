const LinkIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function SourcesList({ sources }) {
  if (!sources || !sources.length) return null;

  return (
    <div style={{ marginTop: 10, marginLeft: 4 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
        Sources
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {sources.map((s, i) => (
          <a
            key={s.url || i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 20, padding: '5px 10px', color: 'var(--ink-soft)', maxWidth: 220,
            }}
          >
            <LinkIcon />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              [{i + 1}] {hostnameOf(s.url)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
