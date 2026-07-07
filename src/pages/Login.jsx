import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithGoogle, loginWithEmail, signUpWithEmail } from '../lib/firebase.js';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.6-6 7.9-11.3 7.9-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.4-5.4C34.6 7.1 29.6 5 24 5c-7.7 0-14.4 4.3-17.7 10.7z"/>
    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.5c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.3-11.3-7.9l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.5C41.5 35.8 44 30.4 44 24c0-1.3-.1-2.7-.4-3.5z"/>
  </svg>
);

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setError('');
    setBusy(true);
    try {
      await loginWithGoogle();
      navigate('/');
    } catch (e) {
      setError('Google sign-in failed. Please try again.');
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      navigate('/');
    } catch (e) {
      setError(friendlyError(e.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Fintly AI Agent</div>
        <p style={styles.tagline}>Your multi-model AI, always at its best.</p>

        <button onClick={handleGoogle} disabled={busy} style={styles.googleBtn}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div style={styles.divider}><span>or</span></div>

        <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" disabled={busy} style={styles.primaryBtn}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Sign Up'}
          </button>
        </form>

        <div style={styles.switchMode}>
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => setMode('signup')} style={styles.linkBtn}>Sign up</button></>
          ) : (
            <>Already have an account? <button onClick={() => setMode('login')} style={styles.linkBtn}>Log in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use': 'That email is already registered — try logging in instead.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

const styles = {
  page: {
    minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'radial-gradient(circle at 50% 0%, #1a1d29 0%, #0F1115 60%)',
    padding: 20,
  },
  card: {
    width: '100%', maxWidth: 380, background: '#161923', borderRadius: 20,
    padding: '32px 24px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  logo: {
    fontSize: 24, fontWeight: 700, textAlign: 'center', color: '#fff',
    background: 'linear-gradient(90deg, #6EA8FE, #B084F5)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  tagline: { textAlign: 'center', color: '#8A8F9C', fontSize: 13, marginTop: 6, marginBottom: 26 },
  googleBtn: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    background: '#fff', color: '#1a1a1a', fontWeight: 600, fontSize: 14.5,
    padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer',
  },
  divider: {
    display: 'flex', alignItems: 'center', textAlign: 'center', color: '#5A5F6B',
    fontSize: 12.5, margin: '18px 0',
  },
  input: {
    background: '#1E2230', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12,
    padding: '13px 14px', color: '#fff', fontSize: 16, outline: 'none', width: '100%',
  },
  primaryBtn: {
    background: 'linear-gradient(90deg, #6EA8FE, #B084F5)', color: '#0F1115', fontWeight: 700,
    fontSize: 14.5, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer', marginTop: 4,
  },
  error: { color: '#FF8A8A', fontSize: 13, textAlign: 'center' },
  switchMode: { textAlign: 'center', color: '#8A8F9C', fontSize: 13, marginTop: 20 },
  linkBtn: { color: '#8FB8FF', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 },
};
