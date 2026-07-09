import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { watchProfile, saveCustomInstructions, addMemory, removeMemory } from '../lib/profile.js';
import { watchUsage } from '../lib/usage.js';
import { getStoredTheme, applyTheme } from '../lib/theme.js';
import RequestTokensModal from '../components/RequestTokensModal.jsx';

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

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [instructions, setInstructions] = useState('');
  const [memories, setMemories] = useState([]);
  const [newMemory, setNewMemory] = useState('');
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [usage, setUsage] = useState(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [theme, setTheme] = useState(getStoredTheme());

  const handleThemeChange = (next) => {
    setTheme(next);
    applyTheme(next);
  };

  useEffect(() => {
    if (!user) return;
    const unsub = watchProfile(user.uid, (profile) => {
      setInstructions(profile.customInstructions);
      setMemories(profile.memories);
      setLoaded(true);
    });
    return unsub;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = watchUsage(user.uid, setUsage);
    return unsub;
  }, [user]);

  const handleSaveInstructions = async () => {
    await saveCustomInstructions(user.uid, instructions);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const handleAddMemory = async () => {
    const text = newMemory.trim();
    if (!text) return;
    setNewMemory('');
    await addMemory(user.uid, text);
  };

  const handleRemoveMemory = async (fact) => {
    await removeMemory(user.uid, fact);
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
        <div style={{ fontWeight: 700, fontSize: 16 }}>Settings</div>
      </div>

      <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 18px 60px' }}>
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15.5, marginBottom: 6 }}>Usage</h2>
          {usage ? (
            usage.unlimited ? (
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--accent-blue)', borderRadius: 14,
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>♾️</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>You have unlimited messages.</span>
              </div>
            ) : (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    {usage.dailyUsed} of {usage.dailyCap} used today
                  </span>
                  {usage.extraMessages > 0 && (
                    <span style={{ fontSize: 12.5, color: 'var(--accent-blue)', fontWeight: 600 }}>
                      +{usage.extraMessages} bonus
                    </span>
                  )}
                </div>
                <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{
                    height: '100%', borderRadius: 6, background: 'var(--accent-gradient)',
                    width: `${Math.min(100, (usage.dailyUsed / usage.dailyCap) * 100)}%`,
                  }} />
                </div>
                {!usage.canSend && (
                  <button
                    onClick={() => setShowRequestModal(true)}
                    style={{
                      fontSize: 13, fontWeight: 700, color: '#0F1115', padding: '9px 18px',
                      borderRadius: 12, background: 'var(--accent-gradient)',
                    }}
                  >
                    Request More Tokens
                  </button>
                )}
              </div>
            )
          ) : (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13 }}>Loading…</div>
          )}
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15.5, marginBottom: 6 }}>Appearance</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => handleThemeChange('dark')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
                background: theme === 'dark' ? 'var(--accent-gradient)' : 'var(--surface)',
                color: theme === 'dark' ? '#0F1115' : 'var(--ink-soft)',
                border: theme === 'dark' ? 'none' : '1px solid var(--border)',
              }}
            >
              🌙 Dark
            </button>
            <button
              onClick={() => handleThemeChange('light')}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '12px 0', borderRadius: 12, fontSize: 13.5, fontWeight: 600,
                background: theme === 'light' ? 'var(--accent-gradient)' : 'var(--surface)',
                color: theme === 'light' ? '#0F1115' : 'var(--ink-soft)',
                border: theme === 'light' ? 'none' : '1px solid var(--border)',
              }}
            >
              ☀️ Light
            </button>
          </div>
        </section>

        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 15.5, marginBottom: 6 }}>Custom Instructions</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
            Tell Fintly Pro how you'd like it to behave — tone, format, level of detail, or anything
            it should always keep in mind when answering you. This applies to every chat.
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. I'm a Class 12 student preparing for board exams. Keep explanations simple and give examples. Always answer in a mix of English and Hindi if I ask in Hindi."
            rows={6}
            disabled={!loaded}
            style={{
              width: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 14, padding: '14px 16px', color: 'var(--ink)', fontSize: 14.5,
              fontFamily: 'inherit', resize: 'vertical', outline: 'none', lineHeight: 1.5,
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button
              onClick={handleSaveInstructions}
              disabled={!loaded}
              style={{
                fontSize: 13.5, fontWeight: 700, color: '#0F1115',
                padding: '10px 20px', borderRadius: 12, background: 'var(--accent-gradient)',
              }}
            >
              Save
            </button>
            {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>Saved ✓</span>}
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: 15.5, marginBottom: 6 }}>What Fintly Pro Remembers About You</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.5 }}>
            These facts are remembered across ALL your chats, not just the current one — so you
            never have to repeat yourself. Add anything worth remembering, or remove something below.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
              placeholder="e.g. I prefer short, direct answers"
              style={{
                flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '11px 14px', color: 'var(--ink)', fontSize: 14.5, outline: 'none',
              }}
            />
            <button
              onClick={handleAddMemory}
              style={{
                fontSize: 13.5, fontWeight: 700, color: '#0F1115',
                padding: '0 18px', borderRadius: 12, background: 'var(--accent-gradient)', flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>

          {loaded && memories.length === 0 && (
            <div style={{ color: 'var(--ink-faint)', fontSize: 13.5, padding: '10px 2px' }}>
              Nothing saved yet. Add a fact above, or ask Fintly Pro to "remember" something during a chat.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {memories.map((fact) => (
              <div key={fact} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
                padding: '11px 14px',
              }}>
                <span style={{ fontSize: 14, lineHeight: 1.4 }}>{fact}</span>
                <button
                  onClick={() => handleRemoveMemory(fact)}
                  title="Forget this"
                  style={{ color: 'var(--ink-faint)', flexShrink: 0, padding: 4 }}
                >
                  <TrashIcon />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {showRequestModal && <RequestTokensModal onClose={() => setShowRequestModal(false)} />}
    </div>
  );
}
