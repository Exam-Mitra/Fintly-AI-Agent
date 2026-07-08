import { useState } from 'react';

// The "transparency panel" — Fintly Pro's signature differentiator. Most AI
// chat apps show you one answer and pretend it came from one all-knowing
// brain. Fintly Pro visibly shows that it consulted several independent AI
// engines in parallel and picked/merged the best result — without ever
// revealing which real companies power those engines (always "Engine 1",
// "Engine 2", etc., matching the "Fintly Pro" branding-only rule).
const BoltIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export default function EngineStatus({ meta }) {
  const [open, setOpen] = useState(false);
  if (!meta || !meta.totalEngines) return null;

  const { modelsUsed, totalEngines, elapsedMs, engineTimings } = meta;
  const seconds = elapsedMs ? (elapsedMs / 1000).toFixed(1) : null;

  return (
    <div style={{ marginTop: 8, marginLeft: 4 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5,
          color: 'var(--ink-faint)', fontWeight: 600, padding: '4px 2px',
        }}
      >
        <BoltIcon />
        Fintly Pro consulted {totalEngines} engines · {modelsUsed} responded
        {seconds ? ` · ${seconds}s` : ''}
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, padding: '10px 12px',
          background: 'var(--surface-2)', borderRadius: 10, border: '1px solid var(--border)',
        }}>
          {(engineTimings || []).map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5,
                padding: '5px 10px', borderRadius: 20,
                background: 'var(--surface)', border: '1px solid var(--border)',
                color: e.ok ? 'var(--ink)' : 'var(--ink-faint)',
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: e.ok ? 'var(--success)' : 'var(--danger)',
              }} />
              Engine {e.id}
              <span style={{ color: 'var(--ink-faint)' }}>
                {e.ok ? `${(e.ms / 1000).toFixed(1)}s` : 'timed out'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
