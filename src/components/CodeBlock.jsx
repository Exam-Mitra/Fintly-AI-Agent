import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — silently ignore
    }
  };

  return (
    <div style={{
      borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)',
      margin: '4px 0 12px', background: '#0B0D12',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px', background: '#12141B', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5,
            color: copied ? 'var(--success)' : 'var(--ink-soft)', fontWeight: 600,
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Highlight theme={themes.vsDark} code={code.replace(/\n$/, '')} language={language || 'text'}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre style={{
            margin: 0, padding: '14px 16px', overflowX: 'auto',
            fontSize: 13.5, lineHeight: 1.65, background: 'transparent', border: 'none', borderRadius: 0,
          }}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
