import { createContext, useContext, useEffect, useState } from 'react';
import { watchAuthState, checkRedirectResult } from './firebase.js';
import { getPendingReferral, clearPendingReferral } from './referralCapture.js';
import { claimReferral } from './referral.js';

const AuthContext = createContext({ user: null, loading: true });

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkRedirectResult().catch(() => {});

    const unsubscribe = watchAuthState((firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      const pendingCode = getPendingReferral();
      if (firebaseUser && pendingCode) {
        claimReferral(pendingCode, firebaseUser.uid).finally(() => clearPendingReferral());
      }
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
