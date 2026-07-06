import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0F1115', color: '#8A8F9C', fontSize: 14,
      }}>
        Loading…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return children;
}
