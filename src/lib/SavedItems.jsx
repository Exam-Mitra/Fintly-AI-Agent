import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { watchSavedAnswers, deleteSavedAnswer, moveSavedAnswer, groupByFolder } from '../lib/saved.js';
import { exportAnswerAsPdf } from '../lib/exportPdf.js';
import MarkdownMessage from '../components/MarkdownMessage.jsx';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export default function SavedItems() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [activeFolder, setActiveFolder] = useState('All');

  useEffect(() => {
    if (!user) return;
    const unsub = watchSavedAnswers(user.uid, setItems);
    return unsub;
  }, [user]);

  const grouped = useMemo(() => groupByFolder(items), [items]);
  const folderNames = useMemo(() => ['All', ...Object.keys(grouped).sort()], [grouped]);
  const visibleItems = activeFolder === 'All' ? items : (grouped[activeFolder] || []);

  const handleDelete = async (id) => {
    if (!confirm('Remove this saved answer?')) return;
    await deleteSavedAnswer(user.uid, id);
  };

  const handleMove = async (id) => {
    const target = prompt('Move to which folder?', 'General');
    if (target === null) return;
    await moveSavedAnswer(user.uid, id, target);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5,
      }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--ink-soft)' }}>
          <BackIcon />
        </button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Saved Answers</div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px 60px' }}>
        {folderNames.length > 1 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
            {folderNames.map((name) => (
              <button
                key={name}
                onClick={() => setActiveFolder(name)}
                style={{
                  fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 20,
                  background: activeFolder === name ? 'var(--accent-gradient)' : 'var(--surface-2)',
                  color: activeFolder === name ? '#0F1115' : 'var(--ink-soft)',
                  border: '1px solid var(--border)',
                }}
              >
                {name} {name !== 'All' ? `(${grouped[name]?.length || 0})` : `(${items.length})`}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, marginTop: '15vh' }}>
            No saved answers yet.<br />
            Tap the bookmark icon under any Fintly Pro reply to save it here.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {visibleItems.map((item) => (
            <div key={item.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <button
                  onClick={() => handleMove(item.id)}
                  title="Move to folder"
                  style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase',
                    letterSpacing: 0.5, background: 'var(--surface-2)', padding: '4px 10px', borderRadius: 20,
                  }}
                >
                  {item.folder || 'General'}
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={() => exportAnswerAsPdf(item.text, item.folder)}
                    title="Export as PDF"
                    style={{ color: 'var(--ink-faint)', padding: 6 }}
                  >
                    <DownloadIcon />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Delete"
                    style={{ color: 'var(--ink-faint)', padding: 6 }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
              <MarkdownMessage text={item.text} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
