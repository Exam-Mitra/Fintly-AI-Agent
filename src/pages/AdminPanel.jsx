import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';
import { isAdmin } from '../lib/admin.js';
import { watchAllTokenRequests, approveTokenRequest, markRequestStatus } from '../lib/tokenRequests.js';
import { postBroadcast, clearBroadcast, watchBroadcast } from '../lib/broadcast.js';
import { sendPushToUser, sendPushToAllUsers } from '../lib/pushNotify.js';
import {
  getTotalUserCount, getPendingRequestCount, getTotalConversationCount,
  getTodayMessageTotal, getHeavyUsageToday,
} from '../lib/analytics.js';

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

function timeAgo(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : 0);
  if (!ms) return '';
  const diffMin = Math.floor((Date.now() - ms) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function RequestCard({ req }) {
  const [grantValue, setGrantValue] = useState('50');
  const [busy, setBusy] = useState(false);

  const handleApprove = async () => {
    setBusy(true);
    try {
      await approveTokenRequest(req.id, req.uid, { extraMessages: parseInt(grantValue, 10) || 0 });
      // Best-effort real push notification, in addition to the existing
      // in-app toast (TokenRequestNotifier) — never blocks the approval
      // itself if the user has no push subscription or it fails to send.
      sendPushToUser(req.uid, {
        title: 'Fintly AI Agent',
        body: `Your token request was approved — you got +${grantValue} messages!`,
        url: '/settings',
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleUnlimited = async () => {
    if (!confirm(`Grant UNLIMITED messages to ${req.email}? This cannot be easily undone.`)) return;
    setBusy(true);
    try {
      await approveTokenRequest(req.id, req.uid, { unlimited: true });
      sendPushToUser(req.uid, {
        title: 'Fintly AI Agent',
        body: 'Your token request was approved — you now have unlimited messages!',
        url: '/settings',
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await markRequestStatus(req.id, 'rejected');
      sendPushToUser(req.uid, {
        title: 'Fintly AI Agent',
        body: 'Your token request was reviewed — feel free to submit a new one if you still need more messages.',
        url: '/settings',
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const statusColor = req.status === 'approved' ? 'var(--success)' : req.status === 'rejected' ? 'var(--danger)' : 'var(--accent-blue)';

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '14px 16px', opacity: busy ? 0.6 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{req.email || req.uid}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{timeAgo(req.createdAt)}</span>
          <span style={{
            fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
            color: statusColor, background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 20,
          }}>
            {req.status}
          </span>
        </div>
      </div>

      {req.note && (
        <div style={{
          fontSize: 13.5, color: 'var(--ink-soft)', background: 'var(--surface-2)',
          borderRadius: 10, padding: '10px 12px', marginBottom: 12, lineHeight: 1.5,
        }}>
          "{req.note}"
        </div>
      )}

      {req.status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="number"
            min="1"
            value={grantValue}
            onChange={(e) => setGrantValue(e.target.value)}
            style={{
              width: 80, background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 10px', color: 'var(--ink)', fontSize: 13,
            }}
          />
          <button onClick={handleApprove} disabled={busy} style={{
            fontSize: 12.5, fontWeight: 700, color: '#0F1115', padding: '7px 14px',
            borderRadius: 10, background: 'var(--accent-gradient)',
          }}>
            Approve
          </button>
          <button onClick={handleUnlimited} disabled={busy} style={{
            fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', padding: '7px 14px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--accent-blue)',
          }}>
            Grant Unlimited
          </button>
          <button onClick={handleReject} disabled={busy} style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', padding: '7px 14px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)',
          }}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
      padding: '14px 16px', flex: 1, minWidth: 120,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value === null ? '…' : value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-faint)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function AnalyticsSection() {
  const [stats, setStats] = useState(null);
  const [heavyUsers, setHeavyUsers] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [users, pending, conversations, messagesToday, heavy] = await Promise.all([
        getTotalUserCount(),
        getPendingRequestCount(),
        getTotalConversationCount(),
        getTodayMessageTotal(),
        getHeavyUsageToday(),
      ]);
      setStats({ users, pending, conversations, messagesToday });
      setHeavyUsers(heavy);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ fontSize: 15 }}>Analytics</h2>
        <button onClick={loadStats} disabled={loading} style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard label="Total Users" value={stats?.users ?? null} />
        <StatCard label="Messages Today" value={stats?.messagesToday ?? null} />
        <StatCard label="Total Conversations" value={stats?.conversations ?? null} />
        <StatCard label="Pending Requests" value={stats?.pending ?? null} />
      </div>

      {heavyUsers && heavyUsers.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--danger)', borderRadius: 14, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--danger)' }}>
            ⚠️ Heavy usage today ({heavyUsers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {heavyUsers.map((u) => (
              <div key={u.uid} style={{ fontSize: 12.5, color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{u.uid}</span>
                <span>{u.count} messages</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BroadcastSection() {
  const [current, setCurrent] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = watchBroadcast(setCurrent);
    return unsub;
  }, []);

  const handlePost = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await postBroadcast(draft);
      const message = draft;
      setDraft('');
      // Best-effort — reaches everyone who opted into push, on top of the
      // in-app banner every signed-in user sees regardless.
      sendPushToAllUsers({
        title: 'Fintly AI Agent',
        body: message,
        url: '/',
      }).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    try {
      await clearBroadcast();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 15, marginBottom: 12 }}>Broadcast Announcement</h2>
      <p style={{ fontSize: 12.5, color: 'var(--ink-soft)', marginBottom: 10 }}>
        Shown as a banner to every signed-in user until they dismiss it.
      </p>
      {current?.message && (
        <div style={{
          background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '10px 12px', marginBottom: 10, fontSize: 13,
        }}>
          Currently live: "{current.message}"
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. New feature: voice input is now live!"
          style={{
            flex: 1, background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '10px 12px', color: 'var(--ink)', fontSize: 13.5, outline: 'none',
          }}
        />
        <button onClick={handlePost} disabled={busy || !draft.trim()} style={{
          fontSize: 12.5, fontWeight: 700, color: '#0F1115', padding: '0 16px',
          borderRadius: 10, background: 'var(--accent-gradient)', flexShrink: 0,
        }}>
          Post
        </button>
        {current?.message && (
          <button onClick={handleClear} disabled={busy} style={{
            fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', padding: '0 14px',
            borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', flexShrink: 0,
          }}>
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    if (!user || !isAdmin(user)) return;
    const unsub = watchAllTokenRequests(setRequests);
    return unsub;
  }, [user]);

  if (loading) return null;
  if (!isAdmin(user)) return <Navigate to="/" replace />;

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
        borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 5,
      }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--ink-soft)' }}>
          <BackIcon />
        </button>
        <div style={{ fontWeight: 700, fontSize: 16 }}>Admin Panel</div>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '20px 16px 60px' }}>
        <AnalyticsSection />
        <BroadcastSection />

        <h2 style={{ fontSize: 15, marginBottom: 12 }}>
          Pending Requests {pending.length > 0 && <span style={{ color: 'var(--accent-blue)' }}>({pending.length})</span>}
        </h2>

        {pending.length === 0 && (
          <div style={{ color: 'var(--ink-faint)', fontSize: 13.5, marginBottom: 30 }}>No pending requests right now.</div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {pending.map((req) => <RequestCard key={req.id} req={req} />)}
        </div>

        {resolved.length > 0 && (
          <>
            <h2 style={{ fontSize: 15, marginBottom: 12, color: 'var(--ink-soft)' }}>History</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {resolved.map((req) => <RequestCard key={req.id} req={req} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
