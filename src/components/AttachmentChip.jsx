// Small chip shown either (a) above the composer while a file is attached and
// not yet sent, or (b) inside a sent user message bubble as a lightweight
// record of what was attached (we never store full image data in chat
// history — only a name + kind — to stay well under Firestore's 1MB/document
// limit and keep everything free-tier friendly).
const ImageIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
  </svg>
);
const FileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const PdfIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    <path d="M9 15h1.5a1.5 1.5 0 0 0 0-3H9v5M13 12v5M13 13.5h1.2M17 12v5" strokeWidth="1.3" />
  </svg>
);
const CloseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function AttachmentChip({ name, kind, previewUrl, onRemove }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 20, padding: previewUrl ? '4px 10px 4px 4px' : '6px 12px',
      color: 'var(--ink-soft)', maxWidth: '100%',
    }}>
      {previewUrl ? (
        <img src={previewUrl} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      ) : (
        kind === 'image' ? <ImageIcon /> : kind === 'pdf' ? <PdfIcon /> : <FileIcon />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{name}</span>
      {onRemove && (
        <button onClick={onRemove} title="Remove" style={{ color: 'var(--ink-faint)', flexShrink: 0, display: 'flex' }}>
          <CloseIcon />
        </button>
      )}
    </div>
  );
}
